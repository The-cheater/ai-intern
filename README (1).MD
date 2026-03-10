Weighted scoring - professional keywords flags unnatural/robotic speech (cheating), short/choppy responses (low engagement), or failure to address the question. Non-verbal alignment (facial expressions with transcript) optional for boost/penalty.

Eye tracking in fix position - cheating , behaviour based on eye tracking too nervous- wandering or confident-strategic- Auto-detect neurodiversity signals (e.g., higher gaze wandering but strong logical output → do NOT penalize; adjust weights). we can also add webcam rPPG-derived Heart Rate Variability (HRV)

Resume mapped questions or specific field pre trained question to test logical and behavioural capability

Some behavioural references - Behavioral and Personality Judgment: Emotional states (core for "personality" inference): Sentiment system uses a multi-class Support Vector Machine (SVM) on n-grams, POS tags, word embeddings, etc., to classify positive/negative/neutral. A separate cognitive system analyzes video/audio/text for 8 emotions (happiness, anger, contempt, disgust, fear, sadness, surprise, neutral) every few seconds, producing distribution graphs. Communication skills (behavioral/soft skill): N-gram language model trained on reference answers + duplication detection + sentiment + emotion distribution → overall score. Teamwork/Interpersonal/Behavioral: Dedicated questions on collaboration; scored via similarity to reference teamwork answers + sentiment/emotion (e.g., resilience from handling failure questions). Overall: Combines into personality-like profiles (e.g., positive emotion + strong communication = good cultural fit).

Custom 60–90 second video scenarios based on resume + job description (e.g., “You’re leading a team meeting where a key stakeholder is angry — respond”). Candidate records response (or live chats with AI avatar). Score on your existing teamwork/resilience metrics + new physio signals (does HRV stay stable under pressure? Does gaze stay strategic?). Patentable: The resume-to-scenario mapping + physio-augmented behavioral scoring pipeline.

OCEAN personality features Openness to Experience Most influenced by: Logical creativity on scenario questions (LLM judge), vocabulary richness (text features), exploratory gaze (less fixed), happiness/surprise emotions on new topics. Conscientiousness Most influenced by: Answer relevance/structure (n-gram + similarity), low duplication, stable HRV & pupil during detail questions, consistent strategic eye focus. Extraversion Most influenced by: Positive sentiment & audio energy, high % of strategic/direct eye contact, expressive facial emotions (happiness, surprise). Agreeableness Most influenced by: Teamwork/collaboration question similarity, low anger/contempt, cooperative words (“we”, “together”, “support”), calm HRV on interpersonal scenarios. Neuroticism (inverse = Emotional Stability) Most influenced by: HRV spikes & high pupil dilation on pressure/failure questions, negative emotions (fear, sadness, anger), wandering/nervous gaze, short/choppy responses.

Aggregate everything into a visual “Digital Candidate Twin” profile: Personality facets (your Big-Five-like) + Cognitive Load Resilience score + Authenticity baseline + Logical Efficiency curve. Recruiter dashboard: “85% predicted 6-month success probability” (trained on anonymized past hire performance data via federated learning). Post-interview: Auto-generate transparen\t report for both recruiter and candidate (e.g., “Your resilience dipped on failure question due to HRV spike + negative sentiment

<!-- Stage,Input,Models / Tools (2026 Best Free/Open-Source),Datasets for Training/Fine-tuning,OCEAN Personality Mapping (What defines each trait the most),Output Features

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
Generated Output: A real-time vector of 5 personality scores and 8 emotion probabilities. -->
3. Eye Tracking & Cheating Detector
Training Prompt & Instruction: "Train a lightweight MobileNetV2 backbone for high-speed gaze estimation and behavioral classification. The model should first perform 2D gaze regression to map eye/iris landmarks (provided by MediaPipe) to screen coordinates (X, Y). Secondly, it must be trained on a custom dataset of 'Standard' vs. 'Cheating' behaviors (e.g., reading from a hidden script, looking at a second monitor, or robotic eye movement). The detection logic should specifically flag 'Horizontal Scanning' patterns which are indicative of reading text on a screen, distinct from the 'Searching' gaze of a person thinking logically."

What to use: TensorFlow or PyTorch. Use the MPIIGaze or LPW (Learning by Looking) datasets for base gaze tracking.
Parameters: Input image size 224x224 (eye-crop), Learning Rate = 1e-3, Optmizer = Adam.
Input: High-resolution webcam crop of the eye region + Head pose angles (Euler angles).
Output File Format: .onnx or .tflite (This ensures it can run on the client-side browser or a low-latency edge worker without lag).
Generated Output: Continuous (X, Y) gaze coordinates + a 'Cheating Probability' score (0.0 to 1.0).







<!-- 
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


ui done 9 march 2025 -->



## Your Thinking is 100% Correct

Calibration is essential. Without it, gaze zone boundaries are guessed — with it, they're personalized to that exact screen + camera + face distance setup.

**What calibration solves:**
- Different screen sizes (13" laptop vs 27" monitor) shift where "bottom zone" actually is
- Camera angle (top-mounted vs side) distorts iris coordinate mapping
- Face distance from screen changes gaze vector entirely
- Glasses/contact lenses affect iris landmark detection accuracy

**How it works (9-point dot calibration):**
- Before interview starts, candidate clicks 9 dots shown one by one across screen corners + center
- Each click records the iris (x,y) at that known screen position
- This builds a personal affine transform matrix mapping iris coords → actual screen coords
- Now "red zone" = below 70% of YOUR screen, not a hardcoded guess

**What it also gives you for free:**
- Baseline gaze variance for THIS candidate (some people naturally have more eye movement)
- Neurodiversity adjustment — if baseline wandering is high, cheating threshold auto-scales up
- Blink rate baseline — stress detection becomes relative not absolute

---

## Final Combined Prompt (One Para)

---

Extend `services/video_analysis/` by adding a `calibration/` submodule containing `calibration_runner.py` that implements a 12-15-point screen calibration sequence before every interview session — displaying one dot at a time at positions (top-left, top-right, bottom-left, bottom-right), all four edge midpoints (top-center, bottom-center, left-center, right-center), the absolute screen center, four intermediate inner quadrant centers (upper-left-inner at 0.25/0.25, upper-right-inner at 0.75/0.25, lower-left-inner at 0.25/0.75, lower-right-inner at 0.75/0.75), and two additional horizontal midline points (mid-left-inner at 0.25/0.5, mid-right-inner at 0.75/0.5)  normalized as screen fraction coordinates, capturing 30 frames of iris landmark data per dot via MediaPipe FaceMesh iris landmarks 468 and 473, averaging the (x,y) iris coordinates per dot, then using `numpy.linalg.lstsq` to fit a personal affine transform matrix mapping raw iris coords to actual screen coordinates, saving the result as `outputs/calibration/{session_id}_calibration.json` containing the transform matrix, per-candidate baseline gaze variance (computed as mean frame-to-frame iris displacement across all  points), baseline blink rate (blinks per minute detected via landmark 159/145 vertical distance threshold), and a neurodiversity adjustment factor (if baseline variance > 0.06 scale cheating thresholds up by 1.4x automatically); update `gaze/zone_classifier.py` to load this calibration file and define all three zones dynamically — strategic zone as upper 55% of calibrated screen space center band (±30% x from center), wandering zone as any region with frame-to-frame variance exceeding 1.3× the candidate's own baseline (not a hardcoded value), and red zone as below 72% calibrated screen Y or any gaze vector pointing more than 15 degrees off-screen — so all thresholds are relative to that candidate's own calibrated baseline; update `gaze/cheating_detector.py` to apply the affine transform to every raw iris coordinate before zone classification, adjust the horizontal scan detection threshold to `candidate_baseline_variance × 0.4` instead of fixed 0.02, and add a `calibration_quality_score` (0.0–1.0 based on consistency of 30-frame clusters per dot) that if below 0.6 triggers a recalibration prompt before the interview begins; expose `POST /calibration/start` and `POST /calibration/submit` endpoints in `api/main.py` where submit accepts the session_id and returns the calibration quality score and whether recalibration is needed, and ensure the frontend calibration page (a full-screen dark overlay with a glowing dot that moves on candidate click confirmation) calls these endpoints and only enables the "Begin Interview" button once calibration quality ≥ 0.6, making all downstream gaze zone detection, cheating flags, and OCEAN neuroticism signals fully personalized and legally defensible per candidate session.

Backend — services/video_analysis/
calibration/calibration_runner.py

Defines all 15 calibration points (4 corners, 4 edge midpoints, center, 4 inner quadrant centers, 2 mid-horizontal points)
run_calibration(session_id, measurements) — takes 30 IrisSample objects per point, fits a 3×2 affine matrix via numpy.linalg.lstsq, computes:
baseline_gaze_variance — mean frame-to-frame iris displacement across all clusters
baseline_blink_rate — blinks/minute estimated from iris y-trajectory
neurodiversity_adjustment — 1.4× if baseline variance > 0.06, else 1.0
calibration_quality_score — 0–1 based on cluster tightness per dot
Saves to outputs/calibration/{session_id}_calibration.json
Exposes apply_transform(raw_iris, matrix) used by all downstream consumers
gaze/zone_classifier.py

Loads calibration JSON on init; all thresholds derived from candidate's own baseline
STRATEGIC: calibrated y ≤ 0.55 AND |x − 0.5| ≤ 0.30
WANDERING: frame-to-frame displacement > 1.3 × baseline_variance
RED: calibrated y > 0.72 OR gaze > 15° off-screen
NEUTRAL: everything else
gaze/cheating_detector.py

Applies affine transform to every frame before classification
Horizontal scan threshold: baseline_variance × 0.4 (not hardcoded 0.02)
Risk level divided by neurodiversity_adjustment before thresholding
needs_recalibration property gates all detections when quality < 0.6
API — api/main.py
Added CORS middleware for localhost:3000
POST /calibration/start → returns session_id + 15 ordered calibration points
POST /calibration/submit → accepts session_id + iris measurements → returns calibration_quality_score, needs_recalibration, baseline stats
Frontend — portal/calibration/page.tsx
Full-screen dark overlay with animated glowing dot
Walks through all 15 points; captures 30 frames each via MediaPipe FaceMesh (CDN-loaded, no npm changes needed)
Shows per-point capture progress ring around the dot
Calls both API endpoints; if quality < 0.6 shows "Recalibrate" button; if ≥ 0.6 enables "Begin Interview" → routes to /portal/interview
requirements.txt
Added numpy>=1.26.0, mediapipe>=0.10.0, opencv-python-headless>=4.9.0






Integrate the entire AI platform end-to-end by connecting all existing backend services to the Next.js frontend and ensuring every data flow works seamlessly: starting from the Interviewer Dashboard where the recruiter uploads a resume PDF or pastes a job description triggering POST /parse/pdf or POST /parse/text followed immediately by POST /generate-questions to Qwen2.5 via Ollama which returns 18-20 questions each with an ideal_answer field, then POST /session/create stores the session in Supabase sessions table and returns a session_id plus auto-generated candidate login_id (format: NSC-{6-digit-random}) and password (8-char alphanumeric) which are displayed in the credential card on the frontend and stored hashed in Supabase used only once for interview ; on the Candidate Portal side, after login validation against Supabase candidate_credentials table the candidate hits the calibration page which runs the 15-point gaze calibration via POST /calibration/start and POST /calibration/submit saving calibration.json to Drive under sessions/{session_id}/calibration.json and storing the calibration quality score in Supabase, then the interview page begins displaying questions one by one with countdown timers — for each question the browser simultaneously records audio via MediaRecorder API saving as .wav and video via getUserMedia saving as .mp4, displays a live waveform visualizer, and on answer submission calls POST /session/{id}/save-response which uploads the audio to Google Drive returning audio_file_id, runs Whisper small on the .wav to produce a transcript, feeds the transcript through VADER sentiment and all-MiniLM-L6-v2 cosine similarity against the ideal_answer to produce semantic_score and sentiment dict, then calls Qwen2.5 via services/scoring/llm_marker.py with all signals to produce per-dimension scores (technical/communication/behavioral/engagement/authenticity) and raw OCEAN trait signals, simultaneously uploads the question video chunk to Google Drive returning video_file_id and runs POST /video/analyze-chunk which processes gaze tracking via MediaPipe using the candidate's personal calibration affine transform matrix to classify each frame into strategic/wandering/red zones, runs DeepFace every 3 seconds for 8-class emotion snapshots, runs CHROM rPPG algorithm for hrv_rmssd and hr_bpm, detects cheating via fixation + horizontal scan pattern analysis with neurodiversity-adjusted thresholds, saves any flagged clips to Drive under sessions/{session_id}/flags/ and calls save_video_signals storing gaze_zone_distribution, cheat_flags with timestamps and confidence scores, emotion_distribution, avg_hrv_rmssd, and stress_spike_detected in Supabase video_signals table alongside the video_file_id and audio_file_id; after all 18-20 questions are completed the frontend shows the Thank You screen and triggers POST /session/{id}/finalize which calls services/scoring/ocean_mapper.py to aggregate all per-question ResponseScore objects and VideoSignals, maps each question type (intro/behavioral/logical/situational) to its OCEAN trait contributions using weighted rules, computes final five OCEAN scores (0-100), computes job_fit_score via sentence-transformers cosine similarity between concatenated transcripts and job description, generates success_prediction (High/Medium/Low) and a 2-sentence role_recommendation from Qwen2.5, saves everything to Supabase ocean_reports table via save_ocean_scores, and triggers auto-generation of the candidate's transparent PDF report saved to Drive; on the Interviewer Dashboard the candidates table under each job opening fetches from GET /opening/{id}/candidates showing name, date, overall score badge, success prediction, and OCEAN radar thumbnail, clicking a candidate opens the full Candidate Insight page which fetches GET /session/{id}/report returning the complete joined Supabase record, renders the Digital Candidate Twin profile with a 6-month success probability circular ring, Big Five OCEAN radar chart using recharts, sentiment timeline line chart across all questions, emotion distribution stacked bar chart, HRV stability area chart, Cognitive Load Resilience score card, Authenticity Baseline card, and Logical Efficiency curve, the Per-Question accordion tab shows each question's transcript, scores as progress bars, OCEAN pill badges, gaze zone donut chart, red cheat flag banners with timestamps and confidence scores, emotion snapshot timeline strip, and embedded video and audio players loading files directly from Google Drive via file_id using the Drive API streaming endpoint, the Raw Media tab shows the full stitched interview video with a timeline scrubber highlighting flagged timestamps in red fetched from Drive, and the delete button on any candidate calls DELETE /session/{id} which purges all Drive files and Supabase rows atomically; add comprehensive error handling throughout — all FastAPI endpoints return structured {"error": "message", "code": "ERROR_CODE"} JSON on failure, the frontend displays toast notifications for upload failures, transcription errors, and analysis timeouts, console logs include [NeuroSync][ServiceName] prefixed messages at every pipeline stage for debugging, Whisper and DeepFace failures fall back gracefully (transcript = empty string flagged, emotions = neutral default) so the interview never crashes mid-session, Drive upload failures retry 3 times with exponential backoff before logging to a Supabase error_logs table with session_id, service, error_message, and timestamp, and the frontend interview page has a heartbeat GET /session/{id}/health ping every 30 seconds to detect backend disconnection and show a reconnecting banner without terminating the interview; finally add a docker-compose.yml with services for the FastAPI backend (with all environment variables injected), ensure all new endpoints are documented in FastAPI's auto-generated Swagger UI, update requirements.txt with every new dependency, and add a README.md section documenting the complete setup flow from Google Cloud credentials to Supabase schema migration to Ollama model pull to uvicorn startup so any developer can replicate the full stack in under 30 minutes.