"""
End-to-end demo: load bad interview scores + interview_output.json
-> run OCEAN mapper -> print report -> save JSON
"""
import json
from services.scoring.response_scorer import score_response
from services.scoring.ocean_mapper import build_ocean_report, print_ocean_report
from services.question_gen.models import InterviewScript

# ── Load interview script from interview_output.json ─────────────────────────
with open("interview_output.json") as f:
    raw = json.load(f)

# Assign stages manually since this file predates the 18-question schema
STAGE_OVERRIDES = {
    "q1": "intro",
    "q2": "intro",
    "q3": "technical",
    "q4": "situational",   # Miss Direction hackathon = situational problem solving
    "q5": "logical",       # Weisman score optimisation = logical
    "q6": "technical",
    "q7": "behavioral",
    "q8": "behavioral",
    "q9": "situational",   # adapt to new tech = situational
}
for q in raw["questions"]:
    q["stage"] = STAGE_OVERRIDES.get(q["id"], q["stage"])

script = InterviewScript(**raw)

# ── Simulated bad responses (same as test_scoring_simulation.py) ─────────────
HARVARD = (
    "The stale smell of old beer lingers. It takes heat to bring out the odor. "
    "A cold dip restores health and zest. A salt pickle tastes fine with ham. "
    "Tacos al pastor are my favorite. A zestful food is the hot cross bun."
)
SKIP = "[NO RESPONSE -- candidate was silent]"

BAD_RESPONSES = {
    "q1": HARVARD,
    "q2": "I don't know, I just wanted a change I guess.",
    "q3": SKIP,
    "q4": "It was a hackathon. We built something. It was fine.",
    "q5": "We just tried different things until it worked.",
    "q6": SKIP,
    "q7": "There were some challenges at CoderDojo but I handled them.",
    "q8": "I helped the team. It went okay.",
    "q9": SKIP,
}

IDEAL_ANSWERS = {
    "q1": (
        "I co-founded Pied Piper after developing a universal compression algorithm with a "
        "world-record Weisman Score. I took the CEO role to commercialise it and led the company "
        "through Techcrunch Disrupt, where we won. My background in applied information theory "
        "directly informed every product decision."
    ),
    "q2": (
        "After the intensity of running Pied Piper I wanted to give back by teaching. I developed "
        "a six-week curriculum at CoderDojo that took beginners from zero to their first deployed "
        "web app and was recognised as Teacher of the Month for measurable student progress."
    ),
    "q3": (
        "I built an audio fingerprinting algorithm that compressed and compared audio signatures "
        "against a licensed database, achieving over 95 percent precision in copyright detection. "
        "This protected the platform from DMCA liability and cut manual review overhead by 80 percent."
    ),
    "q4": (
        "At AIHacks 2016 I built Miss Direction using a Chrome Extension that intercepted the "
        "GoogleMaps tile API via a custom service worker proxy, reversing map overlays in real time. "
        "The key challenge was intercepting tiles without breaking existing rendering, which we solved "
        "in 18 hours and won the best-API-use prize."
    ),
    "q5": (
        "I profiled the bottlenecks using compression benchmarks and applied adaptive Huffman coding "
        "plus a novel middle-out variant that exploited data locality. I measured each change with "
        "Weisman Score and real-world throughput tests, ultimately beating the previous world record "
        "by 30 percent as validated by independent testing."
    ),
    "q6": (
        "We used our algorithm to transcode MP4 video streams for enterprise clients, reducing "
        "bandwidth costs by 40 percent at 1080p. For GIF files we applied the length-limited schema "
        "cutting average size by 60 percent, both verified in production environments."
    ),
    "q7": (
        "A student at CoderDojo was falling behind and disengaging. I paired them with a stronger "
        "peer and switched to milestone-based projects. Within three weeks their confidence recovered, "
        "they shipped their first web app on time, and later became a peer mentor themselves."
    ),
    "q8": (
        "I led a group of junior engineers at Pied Piper with no prior production experience. I ran "
        "weekly code reviews and pair-programming sessions, assigning each person one stretch task "
        "per sprint. The team shipped the MVP on schedule and every member grew measurably."
    ),
    "q9": (
        "When we needed WebRTC at Pied Piper I had two days to become proficient. I studied the RFC, "
        "ran isolated experiments, and shipped a proof of concept in 36 hours. The integration went "
        "live without regression and cut P2P latency by 20ms."
    ),
}

JOB_DESCRIPTION = """
Senior Software Engineer - Compression & Distributed Systems

We are looking for an engineer with deep expertise in algorithms, data compression,
and distributed systems. The role requires strong leadership, ability to mentor
junior engineers, and experience shipping production systems at scale.
Candidates should demonstrate problem solving under pressure, collaborative
communication, and a track record of measurable technical outcomes.
"""

# ── Score each response ───────────────────────────────────────────────────────
print("Scoring responses...")
scores = []
for q in script.questions:
    transcript = BAD_RESPONSES.get(q.id, SKIP)
    ideal = IDEAL_ANSWERS.get(q.id, q.ideal_answer or "A strong, detailed, specific answer.")
    score_t = transcript if transcript.strip() and not transcript.startswith("[NO") else SKIP
    result = score_response(q.id, score_t, ideal)
    scores.append(result)
print(f"Scored {len(scores)} questions.")

# ── Build OCEAN report ────────────────────────────────────────────────────────
print("Building OCEAN report (calling Qwen2.5 for recommendation)...")
report = build_ocean_report(
    scores=scores,
    script=script,
    job_description=JOB_DESCRIPTION,
    session_id="richard_bad",
    model="qwen2.5:latest",
)

print_ocean_report(report)
