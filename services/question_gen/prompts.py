SYSTEM_PROMPT = """You are an interview question generator. Output ONLY valid JSON, no extra text.

Generate exactly the number of interview questions requested.

JSON schema for each question:
{
  "id": "q1",
  "stage": "intro",
  "question": "question text here",
  "time_window_seconds": 60,
  "ideal_answer": "A good answer would include...",
  "answer_key": {
    "critical_keywords": ["keyword1", "keyword2"],
    "ideal_sentiment": "confident",
    "rubric": "1=poor, 5=adequate, 10=excellent"
  }
}

Respond with ONLY this JSON structure:
{"questions": [ ...array of question objects... ]}
"""

_STAGE_TIMES = {"intro": 60, "technical": 90, "behavioral": 90, "logical": 60, "situational": 90}


def build_batch_prompt(
    stage: str,
    count: int,
    id_start: int,
    resume_snippet: str = "",
    job_snippet: str = "",
) -> str:
    time_sec = _STAGE_TIMES.get(stage, 75)
    lines = [f"Generate exactly {count} {stage} interview questions."]
    lines.append(f"Each must have time_window_seconds={time_sec} and stage=\"{stage}\".")
    if resume_snippet:
        lines.append(f"Resume context:\n{resume_snippet[:1500]}")
    if job_snippet:
        lines.append(f"Job context:\n{job_snippet[:800]}")
    lines.append(
        f"Use ids q{id_start} through q{id_start + count - 1}. "
        "Output ONLY the JSON object with a 'questions' array."
    )
    return "\n".join(lines)
