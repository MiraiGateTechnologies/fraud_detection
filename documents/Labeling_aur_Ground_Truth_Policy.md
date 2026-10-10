# Labeling aur Ground-Truth Policy
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Labeling aur Ground-Truth Policy |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Lagu data | 15 Sep 2026 se saari withdrawal requests |
| Related documents | Fraud Risk Assessment aur Taxonomy; Model Cards; Continuous Learning aur Retraining Design |

---

## 1. Purpose

Model ki accuracy utni hi bharosemand hai jitne uske labels. Ye policy tay karti hai ki har withdrawal request ko training me **kaunsa label** milega, **kis saboot se**, aur jab saboot saaf na ho tab **kya karna hai**.

Ye niyam abhi tak data preparation ke code (`prepare.py`) aur meetings ke faislon me the. Ab ye ek jagah likhe gaye hain.

---

## 2. Buniyadi Niyam

1. **Data pehle.** Label agent ke remark se akele nahi banta. Remark jo kehta hai, wo data me dikhna chahiye.
2. **Ek request, ek label.** Label request pe lagta hai, user pe nahi.
3. **Reviewer ka faisla sabse upar.** Panel me client reviewer ka decision har niyam se upar hai.
4. **Shak ho to bahar.** Jab saboot saaf nahi, request training se bahar rehti hai. Use galat label nahi diya jaata. Score phir bhi data se banta hai.
5. **Purane account ko benefit of doubt.** 30 din se purana account, bina lock, aur wajah saaf nahi: training se bahar.
6. **Same data, alag faisla.** Agar wahi data kai baar approve hua aur ek baar sirf "hold" se reject, to wo fraud nahi.
7. **Niyam sakht nahi.** Ye niyam abhi ke data pe bane hain. Har mahine reviewers ke faislon se milaake dekhe jayenge, taaki model kuch cases ko ratta na maar le (overfitting).

---

## 3. Label ki Values

| Label | Panel me | Training me |
|---|---|---|
| Fraud example | Fraud example in training | Fraud class |
| Genuine | Genuine (approved) | Genuine class |
| Not fraud | Rejected, platform error | Fraud class se bahar |
| Unknown | Rejected, reason not confirmed | Bahar |
| Watch: user ka reject bhi hua | Watch: user also has a rejected request | Bahar |
| Watch: bina deposit bonus | Watch: bonus with no deposit | Bahar |
| Watch: same master cluster | Watch: same-master cluster | Bahar |
| Watch: P2 jaisa data, approved | Watch: approved, data like P2 | Bahar |
| No data | No betting data | Score nahi |

"Bahar" wali requests ka bhi score banta hai. Unhe bas training me fraud ya genuine nahi maana jaata.

---

## 4. Label Kaise Tay Hota Hai (Priority)

Upar se neeche dekha jaata hai. Pehla niyam jo lagu ho, wahi label deta hai.

| Priority | Saboot | Label | Status |
|---|---|---|---|
| 1 | Panel me reviewer ka decision: **Fraud** | Fraud example | Planned |
| 1 | Panel me reviewer ka decision: **Not fraud** | Genuine (agent ne reject kiya ho tab bhi) | Planned |
| 2 | Review list me tay hua case (Section 7) | Us list ka label | Bana hua |
| 3 | Bets aur statements nahi | No data | Bana hua |
| 4 | Agent reject + platform galti ka remark, aur data me galti ka saboot | Not fraud | Bana hua |
| 5 | Agent reject + fraud remark, aur data me known pattern | Fraud example | Bana hua |
| 6 | Agent reject + withdrawal lock, aur data pattern rule pe baithta hai | Fraud example (review list ke through) | Bana hua |
| 7 | Baaki rejects (wajah saaf nahi, purana account, lock bina pattern) | Unknown (bahar) | Bana hua |
| 8 | Approved, par shak ke signal (Section 6) | Watch (bahar) | Bana hua |
| 9 | Approved, koi shak nahi | Genuine | Bana hua |

---

## 5. Agent Reject ko Kaise Padha Jaata Hai

### 5.1 Remark ki Category
Remark lowercase karke in niyamon se upar se neeche check hota hai:

| # | Remark me | Category |
|---|---|---|
| 1 | "wrong", "oidd", "mistake", "mistkae", "void done", sirf "tech", "game tec" | Platform galti |
| 2 | "small amount" | Chhoti rakam |
| 3 | "no coin" | No coin |
| 4 | "no activity" | No activity |
| 5 | "ground" | Ground line |
| 6 | "ip" (alag shabd) | Same IP |
| 7 | "casino" aur ("check" ya "voided") | Casino checking |
| 8 | "cheat" ya "suspicious" | Cheat |
| 9 | "void" | Bet void |
| 10 | "rate" | Rate |
| 11 | Baaki sab ("hold", ".", "checking", naam) | Wajah nahi |

### 5.2 Remark Data se Milta Hai Ya Nahi
| Category | Data me kya dikhna chahiye |
|---|---|
| Platform galti | Void/rollback statements, ya bets pe void reason, ya galat Fantasy market |
| Casino checking | Casino entries 50% ya zyada |
| Bet void | Void/rollback statements, ya bets pe void reason |
| Rate | Bets pe void reason |
| Cheat | Bahut back-lay, ya 2+ runners pe back, ya chhota deposit aur 10 guna jeet, ya bina deposit bonus |
| Baaki | Data se check nahi ho sakta |

### 5.3 Fraud Remark + Data Match → Kaunsa Pattern
Fraud remark (casino checking, cheat, bet void) data se mile, to pattern is order me tay hota hai:

| Order | Data | Pattern |
|---|---|---|
| 1 | 36+ selections pe back + lay, ya (30%+ selections pe back + lay aur 3+ aisi selections), ya (cheat remark aur 2+ runners pe back) | P3 |
| 2 | Sirf 1 deposit ≤ ₹1,000 aur jeet deposit ki 10 guna+ | P2 |
| 3 | Deposit nahi aur bonus mila | P4 |
| 4 | Casino entries 50%+ aur casino me jeet | P1 |
| – | Inme se koi nahi | Unknown |

36 selections aur 30% ki limit approved users (2+ bets) ke top 10% se li gayi hai.

---

## 6. Approved Requests pe Shak (Watch)

| Watch | Shart | Kyun bahar |
|---|---|---|
| User ka reject bhi hua | Isi user ki koi aur request reject hui | Same user ka faisla saaf nahi |
| Bina deposit bonus | Window me deposit nahi, bonus mila | P4 jaisa data, par approve hua |
| Same master cluster | 7 din se naya account, 1 deposit ≤ ₹1,000, casino 90%+, jeet 10 guna+, aur same master ke 2+ aise users | Group fraud jaisa |
| P2 jaisa data, approved | 1 deposit ≤ ₹1,000, jeet 10 guna+, casino 90%+, account ≤ 30 din | Aise approved aur rejected requests ka data lagbhag ek jaisa (median 26 guna vs 33 guna) |

---

## 7. Review List (Manual Review)

Jab niyam se faisla saaf nahi hota, case review hota hai. Faisla saboot ke saath likha jaata hai aur `prepare.py` ki review list (`MANUAL_FRAUD`) me jaata hai.

**Process:**
1. Data team unclear cases ki list banati hai: remark, lock, account age, data me kya mila, user ki baaki requests.
2. Client ke saath aasaan sawaal (multiple choice) me faisla hota hai.
3. Faisla, date aur wajah review list me likhi jaati hai.
4. Agle retrain me lagu.

**Ab tak ke faisle:**

| Date | Cases | Faisla | Wajah |
|---|---|---|---|
| 29 Sep | Ek master ke 6 naye accounts (approved) | Fraud, P2 | Chhota deposit, casino me 15–34 guna jeet, same master |
| 1 Oct | 3 rejects ("bet void hoga", "hold", "game tech issue") | Fraud, P2 / P1 | Naya account, chhota deposit, 27–115 guna jeet |
| 8 Oct | Remark "." wala reject, user pehle se casino checking fraud | Fraud, P1 | Same data type |
| 8 Oct | 2 rejects (remark "void"), 0–2 din purane accounts, platform reason "Runner1 Back Runner2 Back" | Fraud, P3 | Naya account, kai runners pe back |
| 8 Oct | Reject "same ip" + withdrawal lock; bina deposit casino jeet ₹25,512 | Fraud, P1 | Lock + P1 rule |
| 8 Oct | Reject "casino chking" + withdrawal lock; bina deposit casino jeet ₹15,051 | Fraud, P1 | Lock + P1 rule |
| 8 Oct | Wahi data 6 baar approve, ek baar "hold" se reject | Fraud nahi (bahar) | Same data approve hota raha |
| 8 Oct | 2 purane accounts, bina lock | Fraud nahi (bahar) | Benefit of doubt |

---

## 8. Reviewer Decisions (Panel se, Planned)

| Niyam | Detail |
|---|---|
| Priority | Reviewer ka decision har niyam se upar |
| Kis request pe | Jis request pe decision diya gaya (`record_id`) |
| Reason | Har decision ke saath reason zaroori (3 se 600 characters) |
| Badlav | Player pe sabse naya decision lagu; poori history rehti hai |
| Takraav | Do reviewers ne 7 din ke andar ulta faisla diya, to us run me request bahar aur lead reviewer ko list |
| Cut-off | Run shuru hone se pehle ka export (23:30 IST); baad wale agle run me |
| Hatana | Hataya hua decision label nahi deta; history me rehta hai |

### 8.1 Pattern Answer ka Use
| Answer | Asar |
|---|---|
| Yes, it fits | Fraud example pe pattern ka tag pakka |
| No, it does not fit | Label wahi, par request us pattern ke examples se hategi |
| Other (text) | Naye pattern ki khoj me jayega; 3+ alag users same naam pe hon to naya rule propose hoga |

### 8.2 Selection Bias se Bachav
Reviewers zyadatar 60%+ wale cases dekhte hain, isliye model sirf wahi seekhega jo wo pehle se pakadta hai. Isse bachne ke liye har hafte 60% se neeche ke 20 random requests "spot check" ke roop me queue me aayengi. Unke decisions baaki decisions jaise hi label banenge.

---

## 9. Abhi ke Labels (8 Oct 2026)

| Label | Requests | Users |
|---|---|---|
| Genuine | 54,587 | 17,356 |
| No data | 1,011 | 782 |
| Watch: user ka reject bhi hua | 461 | 117 |
| Unknown | 183 | 164 |
| **Fraud example** | **62** | **57** |
| Watch: bina deposit bonus | 57 | 55 |
| Not fraud | 38 | 34 |
| Watch: P2 jaisa data, approved | 14 | 12 |
| Watch: same master cluster | 12 | 9 |

**Fraud examples pattern ke hisaab se:** P1 22, P2 16, P3 23, P4 1.

**Fraud examples kahan se aaye:**
- 48: agent reject + remark aur data match
- 14: review list

---

## 10. Panel pe Label Kaise Dikhte Hain

- Panel kabhi "Confirmed fraud" nahi likhta. Fraud confirm karna client ka kaam hai; system sirf score deta hai.
- Training fraud example pe "Main reasons" ki pehli line me agent ka faisla aur remark aata hai:
  - "Rejected by agent, remark: casino checking"
  - "Approved by agent; used as a fraud example after data review"
  - "Earlier request rejected by agent, remark: ..."

---

## 11. Quality aur Audit

| Check | Kab |
|---|---|
| Har run apni label table save karega: har request ka label aur uska source (niyam number, review list, reviewer) | Har run |
| Label counts pichhle run se kam hon to wajah label log me | Har run |
| Reviewers aur niyamon ka milan: kitne cases me reviewer ne niyam ka label palta | Har mahine |
| Reviewers ke beech takraav ki list | Har hafte |
| "Unknown" rejects ka hissa (abhi 60%) | Har hafte |

**Niyam badalna:**
- koi niyam jise reviewers baar-baar palatte hain, normal release process se badla jayega
- badlav is document ke change log me likha jayega

---

## 12. Open Decisions

| # | Sawaal | Abhi |
|---|---|---|
| 1 | "Back and lay very frequently" wale 201 rejects (zyadatar purane accounts, bina lock) ko fraud maanein? | Benefit of doubt; zyadatar bahar |
| 2 | Training fraud examples aur unke users ki baad ki requests ko 95% minimum dikhana chalu rakhein? | Chalu |
| 3 | Spot check sample ka size | Har hafte 20 |
| 4 | Lead reviewer kaun | Client batayega |

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
