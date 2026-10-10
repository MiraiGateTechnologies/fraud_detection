# Required Documents: Fraud Detection Platform

**Status:**

- Available = likha hua hai aur current hai
- Partial = thoda hai, ya sirf code me hai
- Missing = abhi likha nahi gaya

**Priority:**

- P0 = abhi chahiye, client ke saath rollout badhane se pehle
- P1 = poore automation se pehle chahiye
- P2 = formal sign-off aur audit ke liye chahiye

---

## 1. Requirements aur Strategy

### 1.1 System Requirements Specification

- **Kyun chahiye:** poora system kya karega (data intake, scoring, review, retraining, reporting), iska ek agreed likhit bayaan. Iske bina har baar scope aur acceptance alag se tay karna padta hai.
- **Isme kya ho:**
  - intake, scoring, review panel aur retraining ki functional requirements
  - non-functional requirements: roz ~2,000 se 4,000 flagged withdrawals, availability, security
  - acceptance criteria
- **Status:** Partial. Review panel ka SRS hai; scoring aur data intake ki requirements nahi likhi.
- **Priority:** P1

### 1.2 Fraud Risk Assessment aur Taxonomy

- **Kyun chahiye:** model ko tabhi parakh sakte hain jab client ke fraud types ki ek tay list ho. Generic list (card-not-present, synthetic identity) is business pe fit nahi hoti.
- **Isme kya ho:** har fraud type ki definition, example, data me dikhne wale signals, kya system use abhi pakad sakta hai, aur uska impact aur likelihood. Kam se kam ye types:
  - P1 casino me asaadharan jeet
  - P2 chhota deposit, phir casino me badi jeet
  - P3 back aur lay, ya ek market me kai runners pe back
  - P4 bina deposit bonus
  - ek master ke neeche account groups aur collusion
  - multi-accounting (same IP)
  - ground betting
  - sports jeet se pehle statement banana
  - wrong-odds aur late bets ka fayda uthana
  - deposit karke kam khel ke withdraw karna
- **Status:** Partial. P1 se P4 Known patterns page aur README me hain; baaki types likhe nahi hain.
- **Priority:** P0

### 1.3 Service Levels aur Timing

- **Kyun chahiye:** agent withdrawal pe median ~2 minute me faisla karta hai, isliye score tabhi kaam ka hai jab time pe aaye. Card payment wale latency numbers (10 se 20 ms) yahan lagu nahi hote.
- **Isme kya ho:**
  - near real-time path me request aane se score aane tak ka time
  - daily batch path ka schedule
  - panel ki availability
  - data me zyada se zyada kitni deri chalegi
  - deadline chhoot jaye to kya hoga
- **Status:** Missing
- **Priority:** P1

### 1.4 Business KPIs

- **Kyun chahiye:** system ki value business ke numbers me naapni hai, sirf model metrics me nahi.
- **Isme kya ho:**
  - kitne paise ka fraud roka gaya
  - genuine withdrawals pe galat alarm rate
  - reviewer ka roz ka kaam
  - faisle me lagne wala time
  - kitna fraud model ne pakda vs sirf agents ne
- **Status:** Missing
- **Priority:** P2

---

## 2. Data

### 2.1 Data Dictionary

- **Kyun chahiye:** kai fields ka matlab seedha nahi hai, aur galat samjhe to data galat padha jaata hai. Jaise bet pe `p_l` us price pe banne wali rakam hai, settled result nahi. Liability user ka sabse zyada nuksaan hai.
- **Isme kya ho:**
  - har entity: risk event, user, master, white label, bet, statement, decision, pattern answer
  - har field ka type, matlab, unit, time zone aur example
- **Status:** Missing
- **Priority:** P0

### 2.2 Platform ke saath Data Contract

- **Kyun chahiye:** source data platform ka hai. Jo fields gayab ya bina matlab ke hain, unki wajah se model kam seekh pata hai, aur unhe sirf platform hi theek kar sakta hai.
- **Isme kya ho:**
  - agreed schema, aur badlav se pehle notice ka time
  - jo gaps band karne hain:
    - bets me time nahi aata
    - IP aur device nahi aate
    - `extra.amount` hamesha khaali hai
    - andar wali `surveillance` list hamesha khaali hai
    - bet status codes (1, 2, 3, 4, 5, 8, 9) ka matlab likha nahi hai
  - data kitni baar aayega aur poora aaya ya nahi, iske checks
- **Status:** Missing
- **Priority:** P0

### 2.3 Data Quality aur Lineage

- **Kyun chahiye:** ek kharab batch chupchaap scores badal deta hai. Panel ka har number us export tak trace hona chahiye jahan se aaya.
- **Isme kya ho:**
  - har batch ke checks: count, duplicates, bina bets/statements wale records
  - quarantine ke niyam
  - lineage: export → feature table → dataset → model → panel release
- **Status:** Partial. Continuous Learning Automation Design me likha hai; abhi bana nahi.
- **Priority:** P1

---

## 3. Models

### 3.1 Labeling aur Ground-Truth Policy

- **Kyun chahiye:** model ki accuracy utni hi bharosemand hai jitne labels. Abhi agent ke faisle aur reviewer ke decision se fraud/genuine label banane ke niyam sirf code aur meetings ke faislon me hain.
- **Isme kya ho:**
  - label ke sources aur unki priority (reviewer ka decision sabse upar)
  - agent ka reject + fraud remark + data match
  - reject + withdrawal lock
  - platform ki galti wale rejects
  - 30 din se purane account ko benefit of doubt
  - kaun se cases training se bahar rahenge
  - reviewers ke beech takraav ho to kya karein
  - in niyamon ka har mahine review
- **Status:** Partial. Data preparation ke code me bana hai aur automation design me summary hai; alag policy nahi hai.
- **Priority:** P0

### 3.2 Model Cards

- **Kyun chahiye:** har model ka ek page jo bataye ki wo kya karta hai, kis data pe train hua, kitna achha chalta hai, aur kahan uspe bharosa nahi karna chahiye.
- **Isme kya ho:**
  - teen models ke liye ek-ek card: pattern model, anomaly model (Layer 2 aur Layer 3), fraud score model
  - har card me: kaam, training data ka time aur label counts, features, metrics (AUC, 1% aur 3% galat alarm pe kitna fraud pakda, hidden-pattern test), kamiyan, version aur owner
- **Status:** Partial. Metrics README aur run reports me hain; formal model cards nahi.
- **Priority:** P1

### 3.3 Score aur Threshold Policy

- **Kyun chahiye:** score hi tay karta hai ki reviewer ko kaun se players dikhenge. Score me har badlav ek business faisla hai, isliye likhit hona chahiye aur uska owner tay hona chahiye.
- **Isme kya ho:**
  - 0 se 99 score ka matlab aur calibration
  - bands: 90–99, 60–89, 40–59, 20–39, 0–19
  - review queue ki limit (60%)
  - 30 din se purane account ka niyam
  - bina deposit chhoti bonus jeet ki limit
  - training ke fraud examples ka minimum score
  - kaun kaunsi limit badal sakta hai
- **Status:** Missing
- **Priority:** P0

### 3.4 Reason Code Catalogue

- **Kyun chahiye:** reviewer aur client ko samajh aana chahiye ki request ka score zyada kyun aaya. Panel me dikhne wali har wajah ka ek tay matlab hona chahiye.
- **Isme kya ho:**
  - "Main reasons" aur "Different from normal users" me dikhne wali har line
  - wo line kab aati hai
  - reviewer use kaise padhe
- **Status:** Missing
- **Priority:** P0

### 3.5 Model Governance aur Validation

- **Kyun chahiye:** industry ke model risk niyam kehte hain ki model release se pehle validate ho, uska ek naam se owner approve kare, use hote waqt monitor ho, aur zarurat pade to pichhla version wapas lag sake.
- **Isme kya ho:**
  - validation tests: user-wise cross-validation, hidden-pattern test, out-of-time test
  - quality gates
  - shadow mode aur champion vs challenger rollout
  - approve karne wale roles
  - change log
  - rollback ka tareeka
- **Status:** Partial. Gates aur rollback automation design me hain; approval roles aur validation report ka template nahi hai.
- **Priority:** P1

### 3.6 Monitoring aur Drift Plan

- **Kyun chahiye:** players ka behaviour aur platform ka data waqt ke saath badalte hain. Jis model pe nazar nahi rakhi jaati, wo bina bataye kamzor ho jaata hai.
- **Isme kya ho:**
  - score drift aur data freshness
  - galat alarm ka trend
  - reviewers ke faisle model se kitna milte hain
  - alert ki limits aur kaun jawab dega
- **Status:** Partial. Automation design me likha hai; abhi bana nahi.
- **Priority:** P1

### 3.7 Continuous Learning aur Retraining Design

- **Kyun chahiye:** isme likha hai ki reviewer ke faisle model tak kaise wapas jaate hain, aur naya model panel tak kaise pahunchta hai.
- **Status:** Available. "Fraud Detection Platform: Continuous Learning Automation Design".
- **Priority:** Ho gaya

---

## 4. Architecture aur Technology

### 4.1 System Architecture Document

- **Kyun chahiye:** engineers aur client ki IT team ko ek hi jagah dikhna chahiye ki kaun se components hain, wo kaise jude hain, aur data kahan rakha hai.
- **Isme kya ho:**
  - **abhi ka architecture:** ingest service + MongoDB, proxy ke peeche EC2 pe review panel, analysis workstation
  - **target architecture:** object storage, scheduled pipeline, release agent
  - abhi ke volume pe Kafka ya Flink jaise bhaari streaming tools ki zarurat nahi
- **Status:** Partial. Target architecture automation design me hai; abhi ka architecture ek jagah likha nahi.
- **Priority:** P1

### 4.2 Deployment, Backup aur Disaster Recovery Runbook

- **Kyun chahiye:** panel me reviewers ke decisions aur accounts hain, jo platform ke data se dobara nahi ban sakte.
- **Isme kya ho:**
  - server setup aur update ke steps
  - review aur accounts database ka roz backup
  - restore test kab-kab hoga
  - recovery point aur recovery time ke targets
  - certificate aur domain ki jaankari
- **Status:** Partial. Setup aur update scripts panel repository me hain; restore test aur recovery targets tay nahi hain.
- **Priority:** P1

---

## 5. Security, Privacy aur Compliance

### 5.1 Access Control aur Security Design

- **Kyun chahiye:** panel me client ka financial data dikhta hai, isliye access seemit hona chahiye, uska review hona chahiye, aur log hona chahiye.
- **Isme kya ho:**
  - roles (reviewer, admin)
  - sign-in policy: ek account ek browser pe, galat koshish ki limit
  - account banane aur hatane ka process
  - server aur network ka access
  - secrets kaise rakhe jaate hain
  - samay-samay pe access review
- **Status:** Partial. Panel me bana hai; policy ke roop me likha nahi.
- **Priority:** P1

### 5.2 Data Privacy aur Retention Policy

- **Kyun chahiye:** user ka data lagu data protection kanoon ke hisaab se rakhna hai. India ke users ke liye ye Digital Personal Data Protection Act, 2023 hai.
- **Isme kya ho:**
  - kaunsa personal data rakha jaata hai (user codes, financial activity) aur kis kaam ke liye
  - exports aur reports me masking
  - raw data, features, decisions aur logs kitne time rakhne hain
  - delete karne ka process
- **Status:** Missing
- **Priority:** P1

### 5.3 Regulatory Compliance Matrix

- **Kyun chahiye:** zimmedariyan is pe nirbhar hain ki client kahan licensed hai aur users kahan hain. Inhe legal counsel se confirm karwana hai.
- **Isme kya ho:**
  - data protection
  - anti-money-laundering ki zimmedariyan (jaise shak wale deposit aur withdrawal behaviour ki reporting)
  - har jurisdiction ke gaming niyam
  - PCI-DSS lagu nahi, kyunki card data process nahi hota
  - GDPR sirf tab lagu, jab EU ke users hon
- **Status:** Missing
- **Priority:** P2

### 5.4 Audit Trail Specification

- **Kyun chahiye:** baad me har faisle aur score ki wajah batayi ja sake, jhagde aur audit ke liye.
- **Isme kya ho:**
  - kya log hota hai: decisions aur unki history, pattern answers, notes, sign-ins, model versions, label snapshots, releases aur rollbacks
  - logs badle na ja sakein
  - logs kitne time rakhne hain aur kaun padh sakta hai
- **Status:** Partial. Decision history, pattern-answer history aur sign-in log bane hue hain; likhe nahi gaye.
- **Priority:** P2

---

## 6. Operations

### 6.1 Reviewer SOP (Case Management)

- **Kyun chahiye:** reviews ek jaise honge to labels bhi ek jaise banenge. Reviewers ko likhit guidance chahiye ki case kaise padhein aur kab fraud mark karein.
- **Isme kya ho:**
  - panel me roz ka kaam
  - score, reasons, statements aur bets kaise padhein
  - kab Fraud aur kab Not fraud chunein
  - pattern wala sawaal kaise answer karein (Yes, No, Other)
  - kaam ka reason kaise likhein
  - lead reviewer tak kab le jaayein
- **Status:** Missing
- **Priority:** P0

### 6.2 Incident Response Playbook

- **Kyun chahiye:** scoring, data intake ya panel band ho jaye to team ko pata ho ki kya karna hai.
- **Isme kya ho:**
  - fail-open: score sirf salah deta hai, isliye uske bina bhi withdrawals chalte rahenge
  - problem kaise pakdi jayegi aur kise bataya jayega
  - har tarah ki kharabi ke liye recovery steps
  - baad me incident ka review
- **Status:** Missing
- **Priority:** P1

### 6.3 Roles aur Responsibilities (RACI)

- **Kyun chahiye:** MiraiGate, client ke reviewers aur client ki IT team ke beech saaf hona chahiye ki kaun kya sambhalta hai.
- **Isme kya ho:** data bhejna, labels, model release, thresholds, panel server, access approval aur incidents, har ek ka owner kaun.
- **Status:** Missing
- **Priority:** P2

---

## Summary

| Priority  | Documents                                                                                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | Fraud taxonomy (1.2), Data dictionary (2.1), Data contract (2.2), Labeling policy (3.1), Score aur threshold policy (3.3), Reason code catalogue (3.4), Reviewer SOP (6.1)                                                                                        |
| P1        | System requirements (1.1), Service levels (1.3), Data quality (2.3), Model cards (3.2), Model governance (3.5), Monitoring (3.6), Architecture (4.1), Deployment aur DR runbook (4.2), Access control (5.1), Privacy aur retention (5.2), Incident response (6.2) |
| P2        | Business KPIs (1.4), Compliance matrix (5.3), Audit trail specification (5.4), RACI (6.3)                                                                                                                                                                         |
| Available | Continuous learning aur retraining design (3.7), Review panel SRS (1.1 ka hissa)                                                                                                                                                                                  |
