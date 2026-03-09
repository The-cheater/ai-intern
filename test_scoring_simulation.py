"""
Simulate a bad interview for Richard Hendricks.
Questions from interview_output.json.
Whisper transcript from harvard.wav used for q1 (realistic audio).
Remaining questions get simulated bland/empty responses.
"""
import json
from services.scoring.response_scorer import score_response

# ── Load questions ────────────────────────────────────────────────────────────
with open("interview_output.json") as f:
    data = json.load(f)
questions = data["questions"]

# ── Harvard.wav Whisper transcript (already captured) ────────────────────────
HARVARD_TRANSCRIPT = (
    "The stale smell of old beer lingers. It takes heat to bring out the odor. "
    "A cold dip restores health and zest. A salt pickle tastes fine with ham. "
    "Tacos al pastor are my favorite. A zestful food is the hot cross bun."
)

# ── Simulated bad candidate responses ────────────────────────────────────────
# Keyed by question id. Empty string = candidate said nothing / skipped.
BAD_RESPONSES = {
    "q1": HARVARD_TRANSCRIPT,              # used harvard.wav transcript (totally off-topic)
    "q2": "I don't know, I just wanted a change I guess.",  # vague, bland
    "q3": "",                              # SKIPPED - said nothing
    "q4": "It was a hackathon. We built something. It was fine.",  # ultra-bland
    "q5": "We just tried different things until it worked.",  # no specifics
    "q6": "",                              # SKIPPED
    "q7": "There were some challenges at CoderDojo but I handled them.",  # no STAR
    "q8": "I helped the team. It went okay.",  # minimal
    "q9": "",                              # SKIPPED
}

# ── Minimal ideal answers synthesised from question keywords ─────────────────
# (Normally these come from the LLM ideal_answer field; here we write them
#  manually since interview_output.json predates the ideal_answer feature)
IDEAL_ANSWERS = {
    "q1": (
        "I co-founded Pied Piper after developing a proprietary universal compression algorithm "
        "that achieved a world-record Weisman Score. My background in applied information theory "
        "led me to see the commercial potential, and I took on the CEO role to bring it to market. "
        "We fielded consistently high Weisman Scores, which validated the technical direction."
    ),
    "q2": (
        "After the intense startup environment at Pied Piper, I wanted to give back by teaching "
        "new programmers at CoderDojo. I was awarded Teacher of the Month for developing a "
        "structured curriculum that took beginners to building their first web apps in six weeks. "
        "It reinforced my belief that strong mentorship accelerates technical growth."
    ),
    "q3": (
        "I developed an audio fingerprinting algorithm that cross-referenced compressed audio "
        "signatures against a licensed music database, identifying copyright matches with over "
        "95% precision. This directly protected Pied Piper's platform from DMCA liability and "
        "reduced manual review overhead by 80%."
    ),
    "q4": (
        "At AIHacks 2016, Miss Direction reversed GoogleMaps overlays via a Chrome Extension. "
        "The hardest challenge was intercepting the Maps tile API without breaking existing "
        "rendering. We solved it with a custom service worker proxy, finishing in 18 hours "
        "and winning the hackathon's best-use-of-API prize."
    ),
    "q5": (
        "I applied both adaptive Huffman coding and a novel middle-out variant that exploited "
        "data locality patterns. I measured success using the Weisman Score metric and "
        "real-world throughput benchmarks. The result was a compression ratio 30% better than "
        "the previous world record, validated by independent third-party testing."
    ),
    "q6": (
        "At Pied Piper we used our algorithm to transcode MP4 streams for video delivery, "
        "reducing bandwidth costs by 40% while maintaining perceptual quality at 1080p. "
        "For GIF compression we applied the same length-limited schema, cutting average GIF "
        "size by 60% — a measurable improvement our enterprise clients used in production."
    ),
    "q7": (
        "At CoderDojo a student was falling behind and becoming disengaged. I restructured my "
        "teaching approach by pairing them with a stronger peer and shifting to project-based "
        "milestones. Within three weeks their confidence improved, they completed their first "
        "web app, and they later became a peer mentor themselves."
    ),
    "q8": (
        "When leading a group of junior engineers at Pied Piper I established weekly code "
        "reviews and pair-programming sessions to accelerate ramp-up. I deliberately assigned "
        "each person one stretch task per sprint so growth was consistent. The team shipped "
        "the MVP on schedule despite having no prior production experience."
    ),
    "q9": (
        "When we needed to integrate a new WebRTC stack at Pied Piper I had two days to become "
        "proficient. I studied the RFC, ran isolated experiments, and implemented a proof of "
        "concept within 36 hours. The integration shipped without regression and reduced "
        "our P2P latency by 20ms."
    ),
}

SKIP_PLACEHOLDER = "[NO RESPONSE — candidate was silent]"

# ── Run scoring ───────────────────────────────────────────────────────────────
print("=" * 65)
print("INTERVIEW SCORING REPORT — Richard Hendricks (BAD INTERVIEW)")
print("=" * 65)

total_combined = 0.0
scored = 0

for q in questions:
    qid = q["id"]
    stage = q["stage"].upper()
    question_text = q["question"]
    transcript = BAD_RESPONSES.get(qid, "")
    ideal = IDEAL_ANSWERS.get(qid, "")

    # Use placeholder text for skipped questions so scorer can still run
    score_transcript = transcript if transcript.strip() else SKIP_PLACEHOLDER

    result = score_response(qid, score_transcript, ideal)

    skipped = transcript.strip() == ""
    flag = "SKIPPED" if skipped else ("!! LOW ENGAGEMENT" if result.engagement_flag else "OK")

    print(f"\n[{stage}] {qid.upper()}")
    print(f"  Q : {question_text[:80]}{'...' if len(question_text)>80 else ''}")
    print(f"  A : {(transcript[:80] + '...') if len(transcript) > 80 else (transcript or '(silence)')}")
    print(f"  Semantic Score  : {result.semantic_score:.4f}")
    print(f"  Sentiment       : compound={result.sentiment.compound:+.3f}  pos={result.sentiment.pos:.2f}  neg={result.sentiment.neg:.2f}")
    print(f"  Engagement Flag : {result.engagement_flag}  =>  {flag}")
    print(f"  Combined Score  : {result.combined_score:.2f} / 10")

    total_combined += result.combined_score
    scored += 1

avg = total_combined / scored if scored else 0
print()
print("=" * 65)
print(f"OVERALL AVERAGE SCORE : {avg:.2f} / 10")
print(f"QUESTIONS SKIPPED     : {sum(1 for r in BAD_RESPONSES.values() if not r.strip())}")
print(f"VERDICT               : {'FAIL — Poor performance' if avg < 4 else 'MARGINAL' if avg < 6 else 'PASS'}")
print("=" * 65)
