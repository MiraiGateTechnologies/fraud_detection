# Regulatory Compliance Matrix
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Regulatory Compliance Matrix |
| Version | 1.1 (review ke liye draft) |
| Date | 14 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Related documents | Data Privacy aur Retention Policy; Access Control aur Security Design; Audit Trail Specification |

> **Zaroori note:** ye document legal advice nahi hai. Kaunsa kanoon lagu hota hai, ye in baaton pe nirbhar hai:
> - client kahan licensed hai
> - users kahan rehte hain
> - MiraiGate aur client ka contract
>
> Har line legal counsel se confirm honi hai. "Lagu?" column abhi ka andaza hai.

---

## 1. Purpose

Ye matrix ek jagah dikhata hai:
- kaunse kanoon aur standards is system pe lag sakte hain
- unki main shartein kya hain
- system abhi unhe kaise poora karta hai
- kya baaki hai aur kiski zimmedari hai

---

## 2. Matrix

**Status ka matlab:** Met = system me hai; Partial = kuch hai, kuch baaki; Gap = nahi hai; N/A = lagu nahi; Confirm = lagu hai ya nahi, counsel batayega.

| # | Kanoon / Standard | Lagu? | Main shartein | System me kaise | Status | Owner |
|---|---|---|---|---|---|---|
| 1 | **Digital Personal Data Protection Act, 2023** (India) aur uske Rules | Haan (India ke users ka digital personal data) | Kaam tay; kam se kam data; security safeguards; breach ki khabar; kaam khatam hone pe delete; fiduciary–processor contract; users ke haq; personal data India ke bahar bhejne pe niyam (cross-border) | Data Privacy aur Retention Policy; pseudonymous codes; access control; logs; live data 60 din me apne aap delete (replica set TTL) | Partial (retention lagu karna, contract terms, breach process, **live data Singapore me rakhne ki approval**) | Client (fiduciary), MiraiGate (processor) |
| 2 | **Information Technology Act, 2000**: reasonable security practices | Haan (MiraiGate India me body corporate) | Data ki uchit security | Access Control aur Security Design | Partial (Gaps S-01 se S-06) | MiraiGate |
| 3 | **CERT-In Directions (28 April 2022)** | Confirm | Cyber incident 6 ghante me CERT-In ko; logs 180 din India me; system clocks NTP se synced | Logs: journald, nginx, sign-in log; Incident Response Playbook | Partial (180 din log retention aur 6 ghante ka process likhna) | MiraiGate |
| 4 | **Online gaming aur betting ke kanoon**: Promotion and Regulation of Online Gaming Act, 2025 (India), state gaming laws | Confirm (client ke business aur users ki location pe nirbhar) | Kaunsi services di ja sakti hain, payments, ads; vendors ki zimmedari | Scope ke bahar; system sirf fraud score deta hai | Confirm | Client + legal counsel; MiraiGate apni service ke liye bhi |
| 5 | **Prevention of Money Laundering Act, 2002** (India) aur client ke license ke AML/CFT niyam | Confirm | Customer due diligence; suspicious transactions ki pehchaan aur report (FIU); records rakhna (aam taur pe 5 saal) | Fraud score aur review; decisions ki history; PAY-01 (deposit karke kam khel ke withdraw) ka rule abhi nahi | Partial | Client (reporting), MiraiGate (detection support) |
| 6 | **Gaming license ke niyam** (client jis jurisdiction me licensed hai) | Confirm | AML/CFT, player protection, records, audit, fraud controls | Fraud detection aur audit trail is me madad karte hain | Confirm | Client |
| 7 | **GDPR** (EU) | Sirf agar EU me rehne wale users hon; abhi data INR aur India users ka | Lawful basis, DPIA, users ke haq, automated decisions pe niyam | Human review (score sirf salah) | N/A jab tak EU users nahi | Client |
| 8 | **PCI-DSS** | Nahi (card data process nahi hota) | – | Card ya bank data liya hi nahi jaata | N/A | – |
| 9 | **Automated decisions / profiling** (DPDP aur best practice) | Best practice | Insaan faisla le; wajah samjhayi ja sake | Score sirf salah; reviewer faisla deta hai; har score ke saath reasons (Reason Code Catalogue) | Met | MiraiGate + client |
| 10 | **Client ke Terms aur Conditions** | Haan | Withdrawal rokne ya bets void karne ka haq T&C me ho; users ko data use ki jaankari | Scope ke bahar | Confirm | Client |
| 11 | **Contract: client–MiraiGate data processing terms** | Haan | Processing sirf instructions pe; confidentiality; sub-processors (AWS); breach ki khabar; delete/return; audit ka haq | Abhi likhit nahi | Gap | Client + MiraiGate |
| 12 | **AWS shared responsibility** | Haan | AWS: infrastructure; MiraiGate: OS, app, data, access | Access Control aur Security Design; MongoDB Replica Set SRS | Partial | MiraiGate |
| 13 | **Model risk management** (banks ke liye guidance; yahan kanoon nahi) | Best practice | Validation, governance, monitoring, change control | Model Cards; quality gates; Monitoring aur Drift Plan | Partial (validation report template aur approvals) | MiraiGate |

---

## 3. Shartein se Evidence tak

| Shart | Evidence (kahan dikhega) |
|---|---|
| Data kis kaam ke liye | Data Privacy aur Retention Policy, Section 3–4 |
| Kam se kam data | Data Dictionary (fields jo use nahi hote); Data Contract (name, KYC nahi) |
| Security safeguards | Access Control aur Security Design; server config; sign-in log |
| Breach ki khabar | Incident Response Playbook; Data Privacy Policy, Section 8 |
| Retention aur deletion | Retention schedule; deletion log |
| Suspicious activity ki pehchaan | Fraud Risk Assessment aur Taxonomy; Model Cards; decisions |
| Records | Audit Trail Specification; `review.db` history; S3 backups |
| Human review | Reviewer SOP; decisions me reviewer ka naam |
| Logs 180 din | Server log retention (Section 4, action 3) |
| Data kahan rehta hai | Data Privacy Policy, Section 9; MongoDB Replica Set SRS (live data: Singapore) |

---

## 4. Actions

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Legal counsel se is matrix ki har line ka review | Client + MiraiGate | P0 |
| 2 | Client–MiraiGate data processing terms likhna aur sign karna | Client + MiraiGate | P1 |
| 3 | Server aur app logs 180 din rakhne ka setup | MiraiGate admin | P1 |
| 4 | Incident Response Playbook me CERT-In ka 6 ghante wala step | MiraiGate | P1 |
| 5 | Retention schedule lagu karna (Data Privacy Policy) | MiraiGate | P1 |
| 6 | AML ke liye PAY-01 (deposit karke kam khel) ka rule ya report, client approval ke baad | MiraiGate + client compliance | P1 |
| 7 | Client batayega ki wo kahan licensed hai aur users kahan se hain | Client | P0 |
| 8 | Live data AWS Singapore region me rakhne ki legal review aur client ki likhit approval (DPDP cross-border) | Client + legal counsel | P0 |

---

## 5. Review

- Har 6 mahine.
- Ya jab client ka license, users ka area, ya koi kanoon badle.
- Owner: client compliance + MiraiGate data lead.

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
| 1.1 | 14 Oct 2026 | Live data Singapore me (cross-border): DPDP row, evidence aur action 8 |
