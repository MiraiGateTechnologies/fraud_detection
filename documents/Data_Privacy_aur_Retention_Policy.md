# Data Privacy aur Retention Policy
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Data Privacy aur Retention Policy |
| Version | 1.1 (review ke liye draft) |
| Date | 14 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Related documents | Access Control aur Security Design; Regulatory Compliance Matrix; Audit Trail Specification |

**Note:** isme diye retention periods **proposal** hain. Aakhri periods client ki policy aur legal counsel tay karenge (Section 11).

---

## 1. Purpose aur Scope

Ye policy batati hai:
- system kaunsa personal data rakhta hai aur kis kaam ke liye
- data kaise kam se kam rakha aur chhupaya jaata hai
- kaunsa data kitne time rakha jaata hai aur kaise delete hota hai

India ke users ke liye lagu kanoon Digital Personal Data Protection Act, 2023 (DPDP Act) hai.

**Scope:** live data ka MongoDB replica set (Singapore), temporary ingest service aur uska MongoDB, workstation ke exports aur datasets, models, review panel, backups, logs.

---

## 2. Roles

| Role | Kaun | Zimmedari |
|---|---|---|
| Data Fiduciary (data ka maalik) | Client (platform operator) | Kis kaam ke liye data use hoga ye tay karna; users ke haq (access, correction, erasure); breach ki reporting |
| Data Processor | MiraiGate Technologies | Client ke kehne pe aur sirf fraud detection ke liye data process karna; security; client ki madad |

Ye roles legal counsel se confirm karne hain, aur client aur MiraiGate ke contract (data processing terms) me likhe jayenge.

---

## 3. Personal Data ki List

| Data | Fields | Kis kaam ke liye | Zaroori? |
|---|---|---|---|
| User ki pehchaan | `user_id`, `user_id_str` (user code) | Requests ko user se jodna | Haan |
| User ka display naam | `user.name` | Kisi kaam ka nahi | **Nahi**; scoring aur panel me use nahi |
| Account | `created_at`, `balance` | Account age, behaviour | Haan |
| Financial activity | Statements: deposit, withdrawal, bonus, casino, sports; amounts aur time | Features aur review | Haan |
| Betting activity | Bets: market, selection, odds, stake, P/L | Features aur review | Haan |
| Platform ka faisla | Status, remarks, reason, locks | Labels | Haan |
| Hierarchy | Master, white label | Groups, reports | Haan |
| IP / device (Planned) | Hash kiya hua | Multi-accounting | Haan, sirf hash |
| Reviewer ka data | Account naam, sign-in time, IP address, browser, decisions | Security aur audit | Haan |

**Jo data kabhi nahi liya jaata:** KYC documents, phone, email, address, bank ya card details, passwords.

---

## 4. Principles

1. **Purpose tay:** data sirf withdrawal fraud ki pehchaan, review, model training aur audit ke liye use hota hai. Marketing ya kisi aur kaam ke liye nahi.
2. **Kam se kam data:** sirf wahi fields jo score ya review me kaam aate hain. Display naam bhejna platform band kar sakta hai.
3. **Pseudonymous:** panel aur reports me user code dikhta hai, naam nahi.
4. **Seemit access:** sirf sign-in kiye reviewers aur MiraiGate ke zaroori log (Access Control aur Security Design).
5. **Seemit samay:** data retention schedule (Section 6) ke baad delete hota hai.
6. **Surakshit:** encrypted transit aur storage, backups encrypted.
7. **Jawabdehi:** har access aur badlav ka log (Audit Trail Specification).

---

## 5. Masking aur Sharing

| Jagah | Niyam |
|---|---|
| Panel | User code dikhta hai; naam nahi |
| Decisions CSV (platform ko wapas) | Poora user code aur user id (platform ko action ke liye chahiye) |
| Documents, presentations, screenshots, training material | User code masked: pehle 3 characters + `***` (jaise `a1b***`); amounts chal sakte hain |
| Chat ya email me data | Sirf masked codes; poore exports kabhi nahi |
| Teesri party (third party) | Koi sharing nahi. Cloud provider (AWS) sirf hosting ke liye |
| Development / test | Asli data sirf MiraiGate ke controlled machines pe; public repository me kabhi nahi |

---

## 6. Retention Schedule (Proposal)

| Data | Kahan | Kitne time | Uske baad |
|---|---|---|---|
| Live data (`surveillance`, `bets`, `statements`) | MongoDB replica set, Singapore | 60 din | TTL index se apne aap delete |
| Raw risk events (temporary source, historical) | Ingest MongoDB, JSON exports, S3 `raw/` | 12 mahine | Delete |
| Feature tables aur training datasets | Workstation / S3 `features/`, `datasets/` | 24 mahine | Delete |
| Label snapshots | Run ke saath | 24 mahine | Delete (sirf counts report me rehte hain) |
| Models, model registry, run reports | S3 `models/`, run reports | System ki poori umar | – |
| Panel data (`dashboard.json`, `activity.db`) | Panel server | Pichhle 12 mahine ke requests | Purane requests build se bahar |
| Reviewer decisions aur history (`review.db`) | Panel server + S3 | Decision ke baad 5 saal, ya client ki AML policy jitna | Delete ya anonymise |
| Pattern answers aur notes | `review.db` | Upar jaisa | Upar jaisa |
| Sign-in log, sessions (`users.db`) | Panel server | 12 mahine | Delete |
| Server aur app logs (nginx, journald, Docker) | Servers | 180 din kam se kam | Delete |
| Backups | S3 | 90 din | S3 lifecycle se apne aap delete |
| Replica set ke EBS snapshots | AWS | 3 din | Lifecycle policy se apne aap delete |
| Workstation pe temporary copies | Analyst machine | 30 din, ya S3 pe jaane tak | Delete |
| Ad-hoc analysis files (Excel, CSV) | Analyst machine | 90 din | Delete |

Decisions ka 5 saal AML record-keeping ki aam practice ke hisaab se proposal hai. Legal counsel confirm karega.

---

## 7. Delete Karne ka Process

1. **Har mahine** ek job (Planned; abhi manual) retention se purana data dhoondhti hai.
2. Delete se pehle MiraiGate data lead ki approval.
3. Delete secure tareeke se. Storage version bhi hata ke. Backups apne lifecycle se khatam hote hain.
4. **Deletion log:** kya, kitna, kab, kisne. Ye log hamesha rehta hai.
5. Agar koi data legal hold pe hai (jaise jaanch ya jhagda), to hold khatam hone tak delete nahi hota.

### 7.1 User ki Erasure Request
- User client ko request deta hai. Client MiraiGate ko likh ke bhejta hai.
- MiraiGate 30 din me us user ka data raw, features, panel data aur backups ke agle cycle se hata deta hai.
- Exception: jahan kanoon rakhne ko kehta hai (jaise AML records); tab data restricted rehta hai.
- Models us ek user ke liye dobara train nahi hote. Agle retrain me wo data shamil nahi hota.

---

## 8. Breach

| Step | Kaun | Kab |
|---|---|---|
| Breach ka pata chalna aur rokna | MiraiGate on-call | Turant (Incident Response Playbook, Sev 1) |
| Client ko khabar | MiraiGate | 24 ghante ke andar (proposal) |
| CERT-In ko cyber incident report (lagu ho to) | MiraiGate / client, counsel ke hisaab se | 6 ghante ke andar |
| Data Protection Board aur users ko khabar | Client (Data Fiduciary) | DPDP niyamon ke hisaab se |
| Incident review | MiraiGate + client | 5 business days |

---

## 9. Data Kahan Rehta Hai

| Data | Location |
|---|---|
| Live data (MongoDB replica set) | AWS **Singapore** region (`ap-southeast-1`) |
| Panel, temporary ingest, backups | AWS (proposal: Mumbai region; confirm karna hai) |
| Analysis | MiraiGate ka workstation; target me S3 |

**Live data Singapore me rahega, yaani India ke bahar.** Iske liye client aur legal counsel ki likhit approval chahiye (DPDP Act ke cross-border niyam; Regulatory Compliance Matrix). Approval aane tak ye Open hai (Section 11).

---

## 10. Abhi ke Actions

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Workstation pe June–July ke purane analysis files aur exports ka review: retention ke bahar wale delete karne ki approval lena | MiraiGate data lead + client | P1 |
| 2 | Platform se `user.name` bhejna band karne ki request | Client / platform | P2 |
| 3 | S3 lifecycle (backups 90 din) set karna | MiraiGate admin | P1 |
| 4 | Data processing terms client ke contract me | Client + MiraiGate (legal) | P1 |
| 5 | Monthly deletion job (abhi manual) | MiraiGate | P2 |
| 6 | Live data Singapore region me rakhne ki client aur legal counsel se likhit approval | Client + MiraiGate (legal) | P0 |
| 7 | Replica set me 60 din ka TTL index lagana (client ka time field aane pe) | MiraiGate admin | P1 |

---

## 11. Open Decisions

| # | Sawaal | Proposal |
|---|---|---|
| 1 | Raw data kitne time | Live data 60 din (replica set, TTL); historical raw 12 mahine |
| 2 | Decisions kitne time | 5 saal / client ki AML policy |
| 3 | AWS region | Live data: Singapore (tay). Panel aur temporary ingest: Mumbai (proposal) |
| 4 | Client ko breach ki khabar kitne time me | 24 ghante |
| 5 | Roles (fiduciary / processor) | Client / MiraiGate |
| 6 | Live data India ke bahar (Singapore) rakhne ki approval | Client + legal counsel |

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
| 1.1 | 14 Oct 2026 | Live data ka MongoDB replica set: 60 din retention (TTL), Singapore region, EBS snapshots 3 din. Cross-border approval ka action aur open decision |
