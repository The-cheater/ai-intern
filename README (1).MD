Weighted scoring - professional keywords flags unnatural/robotic speech (cheating), short/choppy responses (low engagement), or failure to address the question. Non-verbal alignment (facial expressions with transcript) optional for boost/penalty.

Eye tracking in fix position - cheating , behaviour based on eye tracking too nervous- wandering or confident-strategic- Auto-detect neurodiversity signals (e.g., higher gaze wandering but strong logical output → do NOT penalize; adjust weights). we can also add webcam rPPG-derived Heart Rate Variability (HRV)

Resume mapped questions or specific field pre trained question to test logical and behavioural capability

Some behavioural references - Behavioral and Personality Judgment: Emotional states (core for "personality" inference): Sentiment system uses a multi-class Support Vector Machine (SVM) on n-grams, POS tags, word embeddings, etc., to classify positive/negative/neutral. A separate cognitive system analyzes video/audio/text for 8 emotions (happiness, anger, contempt, disgust, fear, sadness, surprise, neutral) every few seconds, producing distribution graphs. Communication skills (behavioral/soft skill): N-gram language model trained on reference answers + duplication detection + sentiment + emotion distribution → overall score. Teamwork/Interpersonal/Behavioral: Dedicated questions on collaboration; scored via similarity to reference teamwork answers + sentiment/emotion (e.g., resilience from handling failure questions). Overall: Combines into personality-like profiles (e.g., positive emotion + strong communication = good cultural fit).

Custom 60–90 second video scenarios based on resume + job description (e.g., “You’re leading a team meeting where a key stakeholder is angry — respond”). Candidate records response (or live chats with AI avatar). Score on your existing teamwork/resilience metrics + new physio signals (does HRV stay stable under pressure? Does gaze stay strategic?). Patentable: The resume-to-scenario mapping + physio-augmented behavioral scoring pipeline.

OCEAN personality features Openness to Experience Most influenced by: Logical creativity on scenario questions (LLM judge), vocabulary richness (text features), exploratory gaze (less fixed), happiness/surprise emotions on new topics. Conscientiousness Most influenced by: Answer relevance/structure (n-gram + similarity), low duplication, stable HRV & pupil during detail questions, consistent strategic eye focus. Extraversion Most influenced by: Positive sentiment & audio energy, high % of strategic/direct eye contact, expressive facial emotions (happiness, surprise). Agreeableness Most influenced by: Teamwork/collaboration question similarity, low anger/contempt, cooperative words (“we”, “together”, “support”), calm HRV on interpersonal scenarios. Neuroticism (inverse = Emotional Stability) Most influenced by: HRV spikes & high pupil dilation on pressure/failure questions, negative emotions (fear, sadness, anger), wandering/nervous gaze, short/choppy responses.

Aggregate everything into a visual “Digital Candidate Twin” profile: Personality facets (your Big-Five-like) + Cognitive Load Resilience score + Authenticity baseline + Logical Efficiency curve. Recruiter dashboard: “85% predicted 6-month success probability” (trained on anonymized past hire performance data via federated learning). Post-interview: Auto-generate transparen\t report for both recruiter and candidate (e.g., “Your resilience dipped on failure question due to HRV spike + negative sentiment

Stage,Input,Models / Tools (2026 Best Free/Open-Source),Datasets for Training/Fine-tuning,OCEAN Personality Mapping (What defines each trait the most),Output Features

1. Resume → Questions, ibm  docline+  Qwen2.5-72B (Ollama),Synthetic 100k+ job postings,—,Resume-mapped + scenario questions 2–3. Capture + Parallel Extraction,Video + Audio,"Whisper large-v3 (STT) GazeFollower + MediaPipe (eye) rPPG-Toolbox (HRV) MobileNetV2 + Local Transformer (8 emotions)","ForDigitStress, UBFC-rPPG, MELD, LPW, eSEE-d",—,"Raw features (gaze, pupil, HRV, emotions, transcript)"   (done on 3 march 2026)


2. Per-Response Analysis,Features + Transcript,"• Logical: Sentence-Transformers + DeepSeek-R1 LLM-as-Judge • Behavioural: LightGBM rules • Cheating: Multi-signal detector",ForDigitStress + your 500 labelled interviews,"Openness → creative/scenario answer complexity + exploratory gaze + happiness on novel Q Conscientiousness → answer structure/relevance + stable HRV + focused gaze Extraversion → positive sentiment/energy + strategic eye contact + expressive face Agreeableness → teamwork similarity + low anger/contempt + cooperative n-grams Neuroticism → HRV spikes + negative emotions + wandering/nervous gaze + pupil dilation on pressure",Per-question scores + raw OCEAN signals


3. Multi-Modal Fusion & Weighted Scoring,All features,"XGBoost / LightGBM (SHAP explainable) OR Late-Fusion Transformer Separate head for OCEAN regression",Fine-tune on ChaLearn First Impressions (video + Big Five labels) + your labelled data + myPersonality text dataset,"Fusion model learns exact weights: • Openness (35% logical creativity + 25% gaze exploration + 20% emotion variety + 20% vocab diversity) • Conscientiousness (40% relevance/structure + 30% HRV stability + 20% low duplication + 10% consistent focus) • Extraversion (40% positive emotion/sentiment + 25% eye contact % + 20% audio energy + 15% facial expressiveness) • Agreeableness (45% teamwork similarity + 25% low negative emotions + 20% cooperative language + 10% calm HRV) • Neuroticism (50% stress/HRV spikes + 25% negative emotions + 15% gaze wandering + 10% pupil spikes)",OCEAN scores (0–100) + weighted Job-Fit Index + Researcher Potential Index
4. Dashboard Report & Candidate Twin,Final fusion output,Streamlit / Gradio + Plotly,—,Full combined personality profile,See detailed report




Write comprehensive implementation plan with all components
System architecture & tech stackIn progress
All ML models with training details, datasets, file formatsIn progress
Resume parsing pipeline (Docling)In progress
Question generation engine (Ollama + Qwen2.5)In progress
Audio/Video capture & recordingIn progress
Speech-to-Text (Whisper)In progress
Eye tracking & gaze analysis (MediaPipe)In progress
Physiological signals (rPPG HRV)In progress
Emotion detection & sentiment analysisIn progress
Answer verification & scoringIn progress
OCEAN personality profilingIn progress
Multi-modal fusion engineIn progress
Cheating detection systemIn progress
Admin dashboardIn progress
UI/UX with warning signs & introIn progress
Time sequence window for question typesIn progress
Folder structure & file organizationIn progress
Verification plan


1. The AI Interviewer LLM (Qwen2.5-72B/7B)
Act as a high-fidelity Professional Senior Recruiter. Your task is to ingest a structured Markdown resume (parsed via IBM Docling) or a Job Description (any one or both) to generate a precise, three-stage interview script (Intro, Technical/Resume-Deep-Dive, and Behavioral). For every question generated, you must also produce a 'Hidden Answer Key' containing critical technical keywords, ideal sentiment markers, and a grading rubric (1-10) to benchmark the candidate’s response. Ensure the questions are non-generic by directly mapping specific project details from the resume to the core requirements of the job description, outputting the final result in a structured format suitable for real-time interviewing.

2. Emotional & Personality Analyzer (Multimodal Fusion)
Training Prompt & Instruction: "Develop a Late-Fusion Transformer architecture that synchronizes three distinct data streams. Stream A (Text) uses BERT/RoBERTa embeddings of the Whisper transcript; Stream B (Audio) uses Wav2Vec2.0 or MFCC features for pitch, tone, and energy; and Stream C (Video) uses facial action units/landmarks. Train this model on the ChaLearn First Impressions V2 and MELD datasets. The model's goal is to regress 5 scalar values (0.0 to 1.0) for the OCEAN personality traits and classify the candidate's emotional state into one of 8 categories (Happiness, Surprise, Neutral, Anger, Contempt, Disgust, Fear, Sadness) every 3 seconds of the interview."

What to use: PyTorch / PyTorch Lightning. Use transformers for the encoders and a custom CrossAttention layer for the fusion.
Parameters: Hidden dimension = 512, Number of heads = 8, Dropout = 0.3, Learning Rate = 5e-5 with a linear warmup.
Input: 10-20 second synchronized chunks of Audio (.wav), Video (.mp4), and Text (.txt).
Output File Format: .pth (PyTorch) or .onnx (for high-speed inference on your production server).
Generated Output: A real-time vector of 5 personality scores and 8 emotion probabilities.
3. Eye Tracking & Cheating Detector
Training Prompt & Instruction: "Train a lightweight MobileNetV2 backbone for high-speed gaze estimation and behavioral classification. The model should first perform 2D gaze regression to map eye/iris landmarks (provided by MediaPipe) to screen coordinates (X, Y). Secondly, it must be trained on a custom dataset of 'Standard' vs. 'Cheating' behaviors (e.g., reading from a hidden script, looking at a second monitor, or robotic eye movement). The detection logic should specifically flag 'Horizontal Scanning' patterns which are indicative of reading text on a screen, distinct from the 'Searching' gaze of a person thinking logically."

What to use: TensorFlow or PyTorch. Use the MPIIGaze or LPW (Learning by Looking) datasets for base gaze tracking.
Parameters: Input image size 224x224 (eye-crop), Learning Rate = 1e-3, Optmizer = Adam.
Input: High-resolution webcam crop of the eye region + Head pose angles (Euler angles).
Output File Format: .onnx or .tflite (This ensures it can run on the client-side browser or a low-latency edge worker without lag).
Generated Output: Continuous (X, Y) gaze coordinates + a 'Cheating Probability' score (0.0 to 1.0).








edits in 9 march
e:/neurosync ai/
├── services/
│   ├── parser/
│   │   ├── models.py      ← ParsedResume, Experience, Project (Pydantic)
│   │   └── parser.py      ← parse_pdf() via Docling, parse_text() via regex
│   └── question_gen/
│       ├── models.py      ← InterviewScript, Question, AnswerKey
│       ├── prompts.py     ← System prompt + build_user_prompt()
│       └── generator.py   ← generate_questions() → calls Ollama /api/chat
├── api/
│   └── main.py            ← FastAPI: /parse/pdf, /parse/text,
│                                      /generate-questions, /parse-and-generate
├── tests/
│   ├── conftest.py        ← sample fixtures + mocked Ollama response
│   ├── test_parser.py     ← 16 unit tests
│   └── test_question_gen.py ← 19 unit tests (all mocked, no Ollama needed)
├── requirements.txt
├── pytest.ini
└── .env.example


pip install -r requirements.txt
uvicorn api.main:app --reload
# Swagger UI at http://localhost:8000/docs
python -m pytest tests/ -v
  done and tested correctly 

done stge 1 


FOR STAGE 2   ( 9 MARCH )
Extend the existing services/question_gen/ module so that each generated Question object from Qwen2.5 also includes an ideal_answer field (a 3-5 sentence gold-standard response generated by Qwen in the same API call as the question). Then create services/scoring/response_scorer.py that accepts a candidate's Whisper transcript and the question's ideal_answer, runs VADER SentimentIntensityAnalyzer on the transcript to extract compound, pos, neg, neu scores, runs all-MiniLM-L6-v2 via SentenceTransformer.encode() to compute cosine similarity between the transcript and ideal_answer as a semantic_score (0.0–1.0), then returns a ResponseScore Pydantic model containing question_id, transcript, semantic_score, sentiment dict, a engagement_flag (True if transcript word count < 30 or semantic_score < 0.25), and a combined_score = (semantic_score * 0.6) + ((sentiment['compound'] + 1) / 2 * 0.4) normalized to 0–10. Finally expose a POST /score/response endpoint in api/main.py that accepts question_id, transcript and returns the full ResponseScore, and update the existing POST /generate-questions response to always include ideal_answer per question.

Part 1 — Whisper Transcription (harvard.wav)

Whisper needs ffmpeg (auto-installed via winget). Used soundfile + scipy to load the wav directly.

Transcript:

"The stale smell of old beer lingers. It takes heat to bring out the odor. A cold dip restores health and zest. A salt pickle tastes fine with ham. Tacos al pastor are my favorite. A zestful food is the hot cross bun."

Language detected: English ✓

Part 2 — Bad Interview Scoring

Q	Stage	Response	Semantic	Compound	Score	Flag
q1	INTRO	Harvard audio (off-topic)	0.00	+0.72	3.44	LOW ENGAGEMENT
q2	INTRO	"I just wanted a change I guess"	0.07	0.00	2.41	LOW ENGAGEMENT
q3	TECHNICAL	silence	0.07	0.00	2.41	SKIPPED
q4	TECHNICAL	"We built something. It was fine."	0.21	+0.20	3.65	LOW ENGAGEMENT
q5	TECHNICAL	"Tried things until it worked."	0.01	0.00	2.04	LOW ENGAGEMENT
q6	TECHNICAL	silence	0.00	0.00	2.00	SKIPPED
q7	BEHAVIORAL	"I handled them." (no STAR)	0.42	+0.04	4.60	LOW ENGAGEMENT
q8	BEHAVIORAL	"I helped the team. It went okay."	0.29	+0.23	4.17	LOW ENGAGEMENT
q9	BEHAVIORAL	silence	0.08	0.00	2.47	SKIPPED
Overall: 3.02 / 10 — FAIL

3 questions skipped (silence)
Every single question flagged for low engagement
q1's harvard.wav audio correctly scored 0.00 semantic (completely off-topic)

Create services/scoring/ocean_mapper.py that takes the complete list of ResponseScore objects (one per answered question) along with the original InterviewScript (which already contains question type tags: intro/behavioral/logical/situational) and the parsed job description text, then maps each question's combined_score, sentiment, and engagement_flag to its corresponding OCEAN trait contribution using these rules: intro questions feed Extraversion (positive sentiment + engagement) and Neuroticism (inverse of stress flags); logical questions feed Conscientiousness (semantic_score + structure) and Openness (vocabulary richness via unique word ratio on transcript); behavioral questions feed Agreeableness (cooperative keywords: "we", "team", "together", "support" detected via simple string scan) and Neuroticism (negative sentiment on failure/pressure questions); situational questions feed Openness (creative angle via semantic distance from ideal — lower similarity but high word count = creative divergence) and Conscientiousness (structured multi-part response detected by sentence count > 3); aggregate all trait signals into five final OCEAN scores (0–100) using weighted averages per trait, then use all-MiniLM-L6-v2 to compute a job_fit_score (0–100) by encoding the concatenated transcripts vs the job description text as cosine similarity, and finally print a structured terminal report showing each OCEAN trait score with a one-line interpretation, the job_fit_score, a success_prediction label (High/Medium/Low based on thresholds: job_fit > 0.70 + avg OCEAN balance = High), and a role_recommendation string generated by Qwen2.5 via Ollama summarizing in 2 sentences whether this candidate fits the role and their strongest/weakest trait, saving the full output as outputs/session_{id}_ocean_report.json for future dashboard use. 


OCEAN PERSONALITY REPORT — Session: richard_bad

Trait	Score	Interpretation
Openness	70.4	Creative thinker — novel ideas, multiple angles
Conscientiousness	2.4	Struggles with deadlines/detail (skipped 3 questions)
Extraversion	18.6	Reserved, needs encouragement to speak up
Agreeableness	40.4	Balances collaboration with assertiveness
Neuroticism	91.0	High stress reactivity under interview pressure
Job Fit Score: 14.6 / 100 — FAIL (Low)
What each layer measured:

Openness 70.4 — driven by q4/q9 situational questions: even bland answers showed some creative divergence from the ideal
Conscientiousness 2.4 — crushed by 3 skipped logical questions (zero semantic score)
Extraversion 18.6 — q1's Harvard audio was off-topic + q2's vague answer = low positive sentiment
Agreeableness 40.4 — q8 had "I helped the team" which caught cooperative keywords; q7 also partial credit
Neuroticism 91.0 — skipped questions + neutral/zero sentiment reads as stress/shutdown behaviour
Job Fit 14.6 — combined transcript of all answers has near-zero cosine similarity to the engineering JD
Report saved to outputs/session_richard_bad_ocean_report.json

stage 2 done 

Satge 3 (video)
 Gaze Logic Design (Your Instinct is Correct)
The 3 gaze zones you need:

Strategic zone (upper-center screen area) → candidate is thinking, recalling — normal
Wandering zone (random movement while answering) → thinking out loud — normal, do NOT penalize
Red zone (fixed gaze + left-right scanning at bottom or off-screen) → reading from phone/notes → flag

The key insight you identified:

Random wandering + good answer = thinking = innocent
Fixed position + rhythmic left-right scan = reading = cheating signal
Eyes off screen entirely (downward) for 3+ seconds = phone check = flag



to do this i first need the ui to be ready

Create a production-grade SaaS frontend in Next.js 14 (App Router) using Tailwind CSS with Cal Sans for all headings, Satoshi for body text, and Matter for UI labels/metadata, built around two completely separate authenticated flows — the Interviewer Dashboard and the Candidate Interview Portal — with the following pages and behavior: the Interviewer side has a landing/login page with a clean split layout (left: product tagline + animated stats, right: email/password form), after login lands on a main dashboard showing active job openings as cards with candidate count, average score, and status badges, a "Create New Opening" button opens a full-page form with two tabs — "Upload Resume" (drag-and-drop PDF zone) and "Paste Job Description" (large textarea) — with a prominent "Generate Interview Link" CTA that shows a loading skeleton while the backend parses and generates questions, then displays a shareable link with copy button and auto-generated candidate login credentials (ID + password shown in a styled credential card); the dashboard sidebar has sections for Openings, Candidates, Reports, and Settings; clicking any job opening goes to the Opening Detail page showing a candidates table with columns for name, date, overall score (colored badge: green/amber/red), OCEAN radar chart thumbnail, success probability percentage, and status (Pending Review / Reviewed), clicking any candidate row opens the Candidate Insight page which is the centerpiece of the recruiter experience — a full Digital Candidate Twin profile built as a multi-section scrollable page with: a hero section showing candidate name, role applied, interview date, and a large "6-Month Success Probability" circular progress ring with percentage; a tabbed section with Overview / Per-Question / Raw Media tabs; the Overview tab shows a Big Five OCEAN radar chart (recharts), a sentiment timeline line chart across all questions, an emotion distribution stacked bar chart, an HRV stability area chart, a Cognitive Load Resilience score card, an Authenticity Baseline score card, and a Logical Efficiency curve chart, all in a responsive 2-column grid of glassmorphism-style cards with dark slate background (#0F1117) and subtle violet/indigo accent borders; the Per-Question tab shows each of the 18-20 questions as an expandable accordion card containing the question text, ideal answer, candidate transcript, individual scores (technical/communication/behavioral/engagement/authenticity) as horizontal progress bars, OCEAN trait contributions as small pill badges, a gaze zone distribution donut chart, cheat flags as red warning banners with timestamps and confidence scores, emotion snapshots as a small horizontal timeline strip, and embedded video player + audio player for that question's recorded files; the Raw Media tab shows the full interview video player with a timeline scrubber that highlights flagged timestamps in red and normal segments in blue; the Candidate Portal is completely separate in design — minimal, focused, calm — starting with a login page (credential input, full-screen enforced after login via the Fullscreen API), then a Permission Gate page with large circular indicators for Camera (green check / red cross) and Microphone (green check / red cross) with a "Test Audio" waveform visualizer, a fullscreen warning banner explaining that exiting fullscreen gives one warning then terminates the interview, and a "I'm Ready — Begin Interview" button that only enables when both permissions are granted; the Interview Page itself is a distraction-free full-screen dark interface showing a top bar with question counter (Q3 of 18), a circular countdown timer that animates and turns amber at 30s remaining and red at 10s, a question card in the center with large readable text (Cal Sans 28px), a live audio waveform visualizer strip at the bottom showing recording is active, a subtle "Recording..." pulsing red dot, and absolutely no other UI elements to maintain candidate focus; between questions a 5-second interstitial screen shows "Answer saved — next question in 5..." with a simple countdown; after the final question a Thank You screen shows "Interview Complete — your responses have been submitted" with a session ID; all fullscreen exit attempts trigger a modal overlay warning (first offense) or immediate interview termination (second offense) with a final locked screen; globally the design system uses background #0F1117, surface cards #161B27, primary accent #6C63FF (violet), success #22C55E, warning #F59E0B, danger #EF4444, all text in white/slate-300, 12px border-radius on cards, subtle box-shadow with violet glow on active elements, smooth 200ms transitions on all interactive states, and fully responsive down to tablet (interview portal locks to landscape on mobile with a rotation prompt).




Create a services/video_analysis/ module with four submodules: capture/video_recorder.py records continuous webcam feed using OpenCV saving per-question video chunks as outputs/video/{session_id}/q{n}.mp4; gaze/gaze_tracker.py uses MediaPipe FaceMesh with refine_landmarks=True to extract iris landmarks 468 and 473 per frame giving normalized (x,y) gaze coordinates, gaze/zone_classifier.py divides the screen into three zones — strategic (upper 60% center band), wandering (any area with high frame-to-frame variance > 0.05), and red (bottom 30% or off-screen), gaze/cheating_detector.py detects cheating by checking if gaze stays in a fixed Y position (variance < 0.02 over 3 seconds) while showing rhythmic horizontal X movement (left-right oscillation with period 0.5–2 seconds detected via scipy.signal.find_peaks on the X coordinate array) and logs a GazeFlag with timestamp, zone, duration, and cheating_confidence (0.0–1.0) while also flagging any continuous downward fixation > 3 seconds as phone_check_suspected; emotions/emotion_detector.py runs DeepFace every 3 seconds on the video chunk returning an EmotionTimeline list of 8-class snapshots with timestamps; rppg/hrv_extractor.py implements the CHROM algorithm using face ROI mean RGB per frame via scipy bandpass filter (0.7–3Hz) returning hrv_rmssd and hr_bpm per question chunk; finally fusion/video_signal_aggregator.py combines all three signals per question into a VideoSignals Pydantic model containing gaze_zone_distribution (% time in each zone), cheat_flags list, emotion_distribution dict, avg_hrv_rmssd, stress_spike_detected (True if HRV drops > 30% vs baseline), and expose POST /video/analyze-chunk in api/main.py accepting session_id and question_id returning the full VideoSignals, and save all flagged clips with timestamps to outputs/flags/{session_id}/ for human reviewer access.