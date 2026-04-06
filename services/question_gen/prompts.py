SYSTEM_PROMPT = """You are an expert technical interviewer generating structured interview questions. Output ONLY valid JSON, no extra text, no markdown fences.

CRITICAL RULES:
1. Every question must be UNIQUE — never repeat the same question or topic across multiple calls.
2. Questions must be SPECIFIC to the resume/JD context provided — not generic interview filler.
3. Technical questions must probe actual depth of knowledge — ask about trade-offs, edge cases, and real implementation details.
4. Behavioral questions must follow STAR format expectation (Situation, Task, Action, Result).
5. Each ideal_answer must be substantive (3-5 sentences minimum) with concrete detail.
6. Do NOT generate vague openers like "Tell me about yourself" or "Where do you see yourself in 5 years".
7. Do NOT repeat topic themes already covered. If the batch context references a prior question topic, choose a different angle.

JSON schema for each question:
{
  "id": "q1",
  "stage": "intro",
  "question": "A specific, distinct question tailored to the resume/JD",
  "time_window_seconds": 60,
  "ideal_answer": "A detailed 3-5 sentence model answer covering the key points an excellent candidate would address",
  "answer_key": {
    "critical_keywords": ["keyword1", "keyword2", "keyword3"],
    "ideal_sentiment": "confident",
    "rubric": "1=vague/generic, 5=adequate with some specifics, 10=precise with measurable outcomes and depth"
  }
}

Respond with ONLY this JSON structure:
{"questions": [ ...array of question objects... ]}
"""

from typing import List, Optional

_STAGE_TIMES = {"intro": 60, "technical": 90, "behavioral": 90, "logical": 60, "situational": 90}


def build_batch_prompt(
    stage: str,
    count: int,
    id_start: int,
    resume_snippet: str = "",
    job_snippet: str = "",
    already_used_topics: Optional[List[str]] = None,
) -> str:
    import time
    build_start = time.time()
    time_sec = _STAGE_TIMES.get(stage, 75)

    stage_guidance = {
        "intro": "Focus on role motivation, career trajectory, and communication style. Avoid 'tell me about yourself' — ask specific openers tied to their background.",
        "technical": "Ask about specific technologies, architectures, or challenges visible in the resume. Probe trade-offs, debugging approaches, and system design decisions.",
        "behavioral": "Use STAR-format scenarios tied to real work situations. Focus on conflict resolution, delivery under pressure, and collaboration.",
        "logical": "Present a concrete problem-solving scenario relevant to the job. Ask how they would approach debugging, prioritisation, or estimation.",
        "situational": "Present a realistic job situation they would face in this role. Evaluate structured thinking and decision-making.",
    }

    lines = [
        f"Generate exactly {count} UNIQUE and DISTINCT {stage} interview questions.",
        f"Each must have time_window_seconds={time_sec} and stage=\"{stage}\".",
        f"Guidance for {stage} questions: {stage_guidance.get(stage, 'Make questions specific and non-generic.')}",
    ]

    if already_used_topics:
        lines.append(f"AVOID these topics already covered in this interview: {', '.join(already_used_topics)}")

    if resume_snippet:
        lines.append(f"Resume context (reference specific details — projects, technologies, companies):\n{resume_snippet[:1500]}")
    if job_snippet:
        lines.append(f"Job requirements context:\n{job_snippet[:800]}")

    lines.append(
        f"Use ids q{id_start} through q{id_start + count - 1}. "
        "Each question must cover a DIFFERENT topic or skill dimension. "
        "Output ONLY the JSON object with a 'questions' array. No markdown, no extra text."
    )
    prompt = "\n".join(lines)
    elapsed = time.time() - build_start
    if elapsed > 0.1:
        print(f"[Examiney][Prompts] build_batch_prompt({stage}x{count}) took {elapsed:.3f}s", flush=True)
    return prompt
