# Score aur Threshold Policy
# Fraud Detection Platform: Fraud %

| Item | Detail |
|---|---|
| Document | Score aur Threshold Policy |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Model version | Fraud % model, 8 Oct 2026 (data 15 Sep se 8 Oct) |
| Related documents | Model Cards; Reason Code Catalogue; Labeling aur Ground-Truth Policy |

---

## 1. Purpose

Score hi tay karta hai ki reviewer ko kaun se players dikhenge. Isliye score me har badlav ek business faisla hai. Ye policy batati hai:
- score ka matlab kya hai
- har limit kya hai aur kyun
- kaunsi limit kaun badal sakta hai

---

## 2. Score ka Matlab

- **Fraud %** 0 se 99 ka number hai. Panel me ise "Score" kehte hain.
- Ye **probability nahi** hai. Ye batata hai ki request **approved requests ke mukable** kitni upar hai.
- Score 100 kabhi nahi hota. Model kitna bhi milta-julta dekhe, pakka (100%) nahi keh sakta.
- Score sirf salah hai. Withdrawal ka faisla agent aur reviewer ka hai.

### 2.1 Calibration
Approved (genuine) requests ke out-of-fold score se scale tay hota hai:

| Fraud % | Approved requests me se kitne isse upar |
|---|---|
| 20 | 10% |
| 40 | 3% |
| 60 | 1% |
| 90 | 0.1% |
| 99 | Sabse upar wala approved request |

Beech ke score in points ke beech seedhi line (linear) se nikalte hain. Har retrain pe scale naye data se dobara banta hai.

### 2.2 Score Kaise Banta Hai (short)
1. **A (known pattern):** request P1–P4 se kitni milti hai.
2. **B (behaviour):** anomaly score, account group, aur paise ke signals (deposit ke mukable jeet, badi jeet, naya account, 2+ runners pe back, waghera).
3. A aur B me jo bada, wahi raw score.
4. Raw score ko calibration scale pe 0–99 me badla jaata hai.
5. Phir neeche ke niyam (Section 4 se 7) is order me lagte hain:
   - purana account
   - training records ka out-of-fold score
   - bonus limit
   - training fraud example ka minimum

---

## 3. Bands

| Band | Score | Matlab | Requests (15 Sep – 8 Oct) | Agent reject rate (model akele) |
|---|---|---|---|---|
| Very high | 90–99 | Approved me sirf 0.1% itne upar | 166 | 37.1% |
| High | 60–89 | Top 1%; review queue yahan se | 527 | 7.8% |
| Medium | 40–59 | Top 3% | 1,145 | 2.2% |
| Low | 20–39 | Top 10% | 3,963 | 0.9% |
| Normal | 0–19 | Baaki | 49,613 | 0.25% |
| No betting data | – | Bets aur statements nahi | 1,011 | – |

Reject rate model ke akele score pe hai, yaani bina Section 7 ke minimum ke.

### 3.1 Review Queue ki Limit: 60%
- Jis player ki kisi request ka score **60% ya zyada** ho, wo review queue me aata hai.
- **Kyun 60:** approved requests me se sirf 1% isse upar jaate hain. Reviewer ka kaam sambhalne layak rehta hai, aur fraud examples me se 68% model akele isi limit pe pakad leta hai.
- **Bojh:** 24 din me 441 players (693 requests), yaani roz lagbhag 18 naye players.

---

## 4. Purane Account ka Niyam (30 din se zyada)

**Kyun:** fraud zyadatar naye accounts me milta hai. Data me 0–7 din wale accounts ki requests me 1.7% fraud examples the, aur 30+ din wale me sirf 0.04%.

**Kya hota hai** (account age request ke time se):

| Hissa | Niyam |
|---|---|
| Known pattern (A) | Zyada strong match chahiye: 80% ke liye pattern score ~71 chahiye (naye account me ~54) |
| Behaviour (B) | Odds lagbhag 33 guna kam |
| Behaviour ki seema | Bina strong known pattern ke raw score 79% se upar nahi |
| Dikhane ka niyam | Score 95 ya zyada ho to 95–98 ke beech (98 se upar nahi); warna 0–89 me dabaya jaata hai (score × 89/95) |

**Pattern score se Fraud % (sirf pattern ke basis pe):**

| Pattern score | Naya account | 30+ din purana |
|---|---|---|
| 50 | 56% | 42% |
| 75 | 82% | 66% |
| 90 | 95% | 81% |
| 100 | 99% | 88% |

**Nateeja:** 30+ din wale 50,609 requests me se sirf 6 hi 90%+ pe hain.

**Risk:** P1 ke 22 fraud examples me se 16 purane accounts hain, aur inme se 5 requests 60% se neeche hain. Ye Fraud Risk Assessment me R-14 hai.

---

## 5. Training Records ka Score

Jo request training me thi, uska score us model se aata hai **jisne wo request nahi dekhi** (out-of-fold). Isse panel me in cases ka score imaandaar rehta hai, model ki yaaddasht nahi.

---

## 6. Bina Deposit, Bonus se Chhoti Jeet ki Limit

**Kab lagta hai:**
- window me koi deposit nahi
- bonus mila
- P1, P2, P3 me se koi rule nahi laga
- request training fraud example nahi

**Limit (jeet ke hisaab se):**

| Jeet (`total_game_pl`) | Max score |
|---|---|
| ₹2,000 tak | 39 |
| ₹5,000 | 59 |
| ₹10,000 | 79 |
| ₹25,000 | 89 |
| ₹50,000 ya zyada | Koi limit nahi (99) |

Beech ki rakam pe limit seedhi line se nikalti hai.

**Kyun:** 15 Sep – 8 Oct me aise 60 requests me se agents ne sirf 3 reject kiye. Zyadatar ₹365 ke signup bonus se ₹1–2k ki jeet thi.

**Nateeja:** 45 requests ka score kam hua. Jaise ₹365 bonus aur ₹1,065 jeet wala request 99% se 39% pe aaya. Panel me reason: "Small win from a bonus with no deposit, so the score is kept lower".

---

## 7. Training Fraud Examples ka Minimum (95%)

**Kya hai:**
- training ke fraud examples ko panel me kam se kam 95% dikhaya jaata hai
- unhi users ki baad ki requests ko bhi 95% minimum
- purane account pe ye 95 se 98 ke beech rehta hai

**Abhi kitne pe laga:** 62 fraud examples aur unke users ki 23 baad ki requests.

**Dhyan dein:**
- Ye model ka test nahi hai. Model akele in 62 me se sirf 20 ko 90%+ deta hai.
- Repeat users ki baad wali approved requests 95% sirf is niyam ki wajah se dikhti hain.

**Status:** Open. Ise chalu rakhna hai ya model ka apna score dikhana hai, client ko tay karna hai.

---

## 8. Panel pe Dikhana

- Score 1 decimal tak save hota hai. Panel use poore number me round karke dikhata hai.
- **Abhi ki kami:** band 1 decimal wale score se banta hai. Jaise 89.6 panel me "90" dikhta hai, par band "High" rehta hai.
  - **Proposal:** band aur dikhaya gaya number ek hi rounding se banein. Ya to round ki jagah neeche ki taraf kaata jaye, ya band rounded number se bane.
  - **Status:** Open.
- Pattern score aur Unusual score bhi 99 tak hi dikhte hain.

---

## 9. Limits aur unke Owner

| Limit | Abhi | Kaun badal sakta hai | Approval |
|---|---|---|---|
| Calibration points (10% / 3% / 1% / 0.1%) | 20 / 40 / 60 / 90 | MiraiGate data lead | Client risk lead |
| Review queue limit | 60% | Client risk lead | Client risk lead |
| Purane account ki age | 30 din | MiraiGate data lead | Client risk lead |
| Purane account ka dikhane ka niyam | 95–98, warna ≤ 89 | MiraiGate data lead | Client risk lead |
| Bonus jeet ki limit | Section 6 table | MiraiGate data lead | Client risk lead |
| Training fraud example ka minimum | 95 | Client risk lead | Client risk lead |
| Known pattern rule ki limits | Genuine ke 99–99.5 percentile se, har retrain pe | Automatic | Quality gates |
| Max score | 99 | Badla nahi jayega | – |

### 9.1 Badlav ka Process
1. Badlav ki request likhi jaye: kya badalna hai aur kyun.
2. Data team pichhle 4 hafton ke data pe asar ka report banaye:
   - review queue kitni badlegi
   - fraud examples kitne pakde jayenge
   - genuine kitne flag honge
3. Owner aur approver dono sign-off karein.
4. Badlav normal release se lage (quality gates ke saath).
5. Is document ka change log update ho.

**Emergency:** galat score se queue bahut badh jaye to MiraiGate data lead pichhla release wapas laga sakta hai (rollback). Client risk lead ko usi din batana hai.

---

## 10. Open Decisions

| # | Sawaal | Abhi |
|---|---|---|
| 1 | Training fraud example ka 95% minimum rakhein ya hatayein? | Chalu |
| 2 | Display rounding aur band ek jaise karein | Proposal (Section 8) |
| 3 | Purane account ka niyam P1 ke purane fraud accounts ke liye naram karein? | Abhi wahi |
| 4 | Queue limit 60% hi rahe? | 60% |

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
