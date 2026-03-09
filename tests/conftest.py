import json
import pytest

SAMPLE_RESUME_MARKDOWN = """
# John Doe
john.doe@email.com | +1-555-123-4567

## Skills
Python, FastAPI, React, PostgreSQL, Docker, Kubernetes, Machine Learning

## Experience

### Senior Software Engineer — TechCorp Inc (2021-2024)
- Built microservices handling 10M requests/day using FastAPI + Kubernetes
- Led team of 5 engineers on ML inference pipeline

### Software Engineer — StartupXYZ (2019-2021)
- Developed React dashboard with real-time WebSocket updates
- Optimized PostgreSQL queries reducing latency by 40%

## Projects

### AI Resume Screener
NLP pipeline using BERT + FastAPI to screen 500+ resumes/day
Technologies: Python, BERT, FastAPI, Redis

## Education
B.Sc. Computer Science — MIT (2019)
""".strip()

SAMPLE_JOB_DESCRIPTION = """
Senior Backend Engineer — AI Products

Requirements:
- 4+ years Python experience
- Experience with FastAPI or Django
- ML model deployment experience
- Kubernetes/Docker proficiency
- Strong system design skills
""".strip()

MOCK_OLLAMA_RESPONSE = {
    "message": {
        "content": json.dumps({
            "job_title": "Senior Backend Engineer",
            "candidate_name": "John Doe",
            "questions": [
                {
                    "id": "q1",
                    "stage": "intro",
                    "question": "Walk me through your background and what led you to backend/ML engineering.",
                    "time_window_seconds": 60,
                    "answer_key": {
                        "critical_keywords": ["experience", "motivation", "skills"],
                        "ideal_sentiment": "confident, concise",
                        "rubric": "1=unfocused, 5=structured overview, 10=compelling narrative with metrics",
                    },
                },
                {
                    "id": "q2",
                    "stage": "intro",
                    "question": "Why are you interested in this Senior Backend Engineer role?",
                    "time_window_seconds": 60,
                    "answer_key": {
                        "critical_keywords": ["company", "growth", "alignment"],
                        "ideal_sentiment": "enthusiastic, specific",
                        "rubric": "1=generic, 5=researched company, 10=specific role-skill alignment",
                    },
                },
                {
                    "id": "q3",
                    "stage": "technical",
                    "question": "Your microservice handles 10M requests/day. Walk me through how you designed for that scale.",
                    "time_window_seconds": 90,
                    "answer_key": {
                        "critical_keywords": ["FastAPI", "Kubernetes", "load balancing", "scalability"],
                        "ideal_sentiment": "technical, structured",
                        "rubric": "1=vague, 5=mentions components, 10=discusses tradeoffs",
                    },
                },
                {
                    "id": "q4",
                    "stage": "technical",
                    "question": "How did you achieve 40% PostgreSQL latency reduction? Walk me through your process.",
                    "time_window_seconds": 90,
                    "answer_key": {
                        "critical_keywords": ["indexes", "EXPLAIN ANALYZE", "query plan"],
                        "ideal_sentiment": "precise, methodical",
                        "rubric": "1=guessing, 5=mentions indexes, 10=systematic measurement",
                    },
                },
                {
                    "id": "q5",
                    "stage": "technical",
                    "question": "Describe the architecture of your ML inference pipeline at TechCorp.",
                    "time_window_seconds": 90,
                    "answer_key": {
                        "critical_keywords": ["model serving", "latency", "batch", "monitoring"],
                        "ideal_sentiment": "confident, technical",
                        "rubric": "1=no detail, 5=basic serving, 10=covers monitoring and scaling",
                    },
                },
                {
                    "id": "q6",
                    "stage": "technical",
                    "question": "How does your AI Resume Screener handle edge cases like multi-column PDF layouts?",
                    "time_window_seconds": 90,
                    "answer_key": {
                        "critical_keywords": ["BERT", "preprocessing", "fallback", "edge cases"],
                        "ideal_sentiment": "pragmatic, detailed",
                        "rubric": "1=didn't consider, 5=basic handling, 10=systematic approach",
                    },
                },
                {
                    "id": "q7",
                    "stage": "behavioral",
                    "question": "Tell me about leading the 5-engineer ML pipeline team. How did you handle disagreements?",
                    "time_window_seconds": 90,
                    "answer_key": {
                        "critical_keywords": ["leadership", "communication", "outcome"],
                        "ideal_sentiment": "composed, results-oriented",
                        "rubric": "1=no structure, 5=STAR partial, 10=full STAR with outcome",
                    },
                },
                {
                    "id": "q8",
                    "stage": "behavioral",
                    "question": "Describe a time a production system failed. What was your response?",
                    "time_window_seconds": 90,
                    "answer_key": {
                        "critical_keywords": ["incident", "root cause", "mitigation", "retrospective"],
                        "ideal_sentiment": "calm, accountable",
                        "rubric": "1=panic/blame, 5=describes fix, 10=systematic RCA + prevention",
                    },
                },
                {
                    "id": "q9",
                    "stage": "behavioral",
                    "question": "How do you stay current with backend and ML technologies?",
                    "time_window_seconds": 90,
                    "answer_key": {
                        "critical_keywords": ["papers", "open source", "community", "continuous learning"],
                        "ideal_sentiment": "curious, proactive",
                        "rubric": "1=no answer, 5=mentions resources, 10=recent specific examples",
                    },
                },
            ],
        })
    }
}
