# Fraud Risk Assessment aur Fraud Taxonomy
# Fraud Detection Platform: Withdrawal Risk

| Item | Detail |
|---|---|
| Document | Fraud Risk Assessment aur Taxonomy |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Data period | 15 Sep 2026 00:00 se 8 Oct 2026 12:41 IST (24 din) |
| Related documents | System SRS; Labeling aur Ground-Truth Policy; Score aur Threshold Policy; Platform Data Contract |

---

## 1. Purpose aur Scope

Is document ke do kaam hain:
1. **Taxonomy:** platform pe dikhne wale fraud types ki ek tay list. Har type ki definition, data me dikhne wale signals, aur system use abhi pakad pata hai ya nahi.
2. **Risk Assessment:** har type kitni baar hota hai (likelihood), kitna paisa jaata hai (impact), abhi kya control hai, aur control ke baad kitna risk bachta hai (residual risk).

Scope: platform ki flag hui withdrawal requests, jo casino aur sports dono pe hain. Card payment, KYC ya identity fraud is document me nahi hain, kyunki ye data system tak aata hi nahi.

---

## 2. Data aur Tareeka

### 2.1 Data
| Item | Value |
|---|---|
| Flag hui withdrawal requests | 56,425 |
| Users / masters / white labels | 18,004 / 774 / 306 |
| Agent ne reject ki | 307 requests (0.54%), 274 users |
| Training ke fraud examples | 62 requests, 57 users |
| Bina betting data ke requests | 1,011 (1.8%) |

**Saboot ke chaar source:**
- agent ka remark (`remarks`)
- platform ki reason list (`reason`, sirf rejects pe aati hai, saari 307 rejects pe hai)
- request se pehle ke 20 din ke statements aur bets
- review ke baad liye gaye faisle

**"Paisa" ka matlab:** request ke time tak ke 20 din me casino aur sports ka net result (`total_game_pl`). Ye withdrawal amount nahi hai, kyunki `extra.amount` hamesha khaali aata hai. Par house ka exposure isi number se sabse sahi naapa ja sakta hai.

### 2.2 Likelihood Scale (24 din me cases)
"Case" ka matlab hai agent reject ya training fraud example.

| Level | Cases |
|---|---|
| 1 | Koi case nahi |
| 2 | 1 se 5 |
| 3 | 6 se 15 |
| 4 | 16 se 30 |
| 5 | 30 se zyada |

### 2.3 Impact Scale (24 din ka kul paisa)
| Level | Paisa |
|---|---|
| 1 | ₹50,000 se kam |
| 2 | ₹50,000 se ₹2 lakh |
| 3 | ₹2 lakh se ₹10 lakh |
| 4 | ₹10 lakh se ₹50 lakh, ya regulatory (AML) risk |
| 5 | ₹50 lakh se zyada |

### 2.4 Risk Rating
**Risk score = Likelihood × Impact**

| Score | Rating |
|---|---|
| 1 se 4 | Low |
| 5 se 9 | Medium |
| 10 se 14 | High |
| 15 se 25 | Critical |

### 2.5 Control Effectiveness
| Level | Matlab | Residual pe asar |
|---|---|---|
| Strong | 80% ya zyada cases 60%+ score pe | Rating 2 level kam |
| Partial | 40% se 80% cases 60%+ score pe | Rating 1 level kam |
| Weak | 40% se kam cases 60%+ score pe | Koi kami nahi |
| None | System is type ko pakad hi nahi sakta (data nahi ya rule nahi) | Koi kami nahi |

Score ke liye model akele ka score liya gaya hai, yaani training wale cases ka out-of-fold score. Training fraud examples ko dikhaya jaane wala 95% minimum is test me nahi gina gaya.

---

## 3. Fraud Taxonomy

### 3.1 Structure
Har fraud type ka ek code hai: **Category-Number**.

| Category | Code | Matlab |
|---|---|---|
| Casino abuse | CAS | Casino games me asaadharan jeet ya khel |
| Sports betting abuse | SPT | Sports bets ka tareeka ya time ka galat fayda |
| Bonus abuse | BON | Bonus ka bina deposit ya kai accounts se fayda |
| Account aur collusion | ACC | Kai accounts ya users ka milke kaam |
| Paisa ghumana | PAY | Deposit aur withdrawal ka khel ke bina istemaal |
| Fraud nahi (reject ki doosri wajah) | NF | Platform ki galti, chhoti rakam, ya wajah saaf nahi |

Known patterns ka mapping: **P1 = CAS-01, P2 = CAS-02, P3 = SPT-01, P4 = BON-01.**

### 3.2 Summary
| Code | Fraud type | Cases (24 din) | Paisa | System abhi pakadta hai? |
|---|---|---|---|---|
| CAS-01 | Casino me asaadharan khel ya jeet (P1) | 22 fraud examples | ₹1.18 crore | Partial: 17/22 |
| CAS-02 | Chhota deposit, phir badi casino jeet (P2) | 16 fraud examples | ₹4.9 lakh | Strong: 16/16 |
| SPT-01 | Back-lay, ya ek market me kai runners pe back (P3) | 201 rejects (23 fraud examples) | ₹2.06 crore | Weak: 46/201 |
| SPT-02 | Casino me statement banana, phir sports jeet | 59 rejects | ₹22.7 lakh | Partial: 30/59 |
| SPT-03 | Ground line betting | 45 rejects | ₹64.8 lakh | None (bet ka time nahi aata) |
| SPT-04 | Wrong odds aur late bets ka fayda | 28 rejects | ₹19.4 lakh | None (platform ka void process) |
| BON-01 | Bina deposit bonus (P4) | 3 rejects (1 fraud example) | ₹25,000 | Strong |
| ACC-01 | Ek master ke neeche account groups aur collusion | 22 groups jinme reject hai | ₹10.3 lakh | Partial (Layer 3) |
| ACC-02 | Multi-accounting (same IP) | 8 rejects | ₹1.7 lakh | None (IP nahi aata) |
| PAY-01 | Deposit karke kam khel ke withdraw | 7 rejects | AML risk | None (rule nahi) |
| NF-01 | Platform ki galti | 48 rejects | ₹20.4 lakh | Fraud nahi |
| NF-02 | Chhoti rakam | 56 rejects | ₹69,000 | Fraud nahi |
| NF-03 | Wajah saaf nahi | 100 rejects | ₹1.45 crore | Training se bahar |

Ek request ek se zyada type me aa sakti hai (jaise SPT-01 aur ACC-01), isliye cases ka total 307 se zyada hai.

### 3.3 Fraud Types: Details

#### CAS-01: Casino me asaadharan khel ya jeet (P1)
- **Definition:** player ka zyadatar khel casino me hai, aur casino me deposit ke mukable bahut badi jeet hai, ya bina deposit ke badi casino jeet hai.
- **Agent remarks:** "casino checking", "bet void", "cheater", "hold checking with casino provider".
- **Data signals:**
  - casino share 85% ya zyada
  - casino jeet deposit ki 4 guna ya zyada
  - ya deposit nahi aur casino jeet ₹10,000 ya zyada
- **Example:** 91% khel casino me, casino jeet ₹3.74 lakh, yaani deposit ki 16.9 guna.
- **Data:**
  - 22 fraud examples (20 users), 15 white labels, 17 masters
  - paisa ₹1.18 crore (median ₹1.31 lakh, sabse bada ₹51.5 lakh)
  - account age median 128 din; 73% accounts 30 din se purane
- **Detection:**
  - rule 17/22 cases pe lagta hai; genuine requests me 0.53% pe
  - model 60%+ pe 17/22, 90%+ pe 4/22
  - pattern chhupa ke test me 16/22
- **Kami:** 5 requests (4 purane users) 60% se neeche hain. Inme casino jeet deposit ki 4 guna se kam thi.

#### CAS-02: Chhota deposit, phir badi casino jeet (P2)
- **Definition:** naya account ek chhota deposit karta hai aur casino me deposit ki 10 guna ya zyada jeet ke withdraw karta hai. Aksar ek hi master ke neeche kai aise accounts milte hain.
- **Data signals:** sirf 1 deposit, ₹1,000 ya kam; jeet deposit ki 10 guna ya zyada; casino 90% ya zyada; account 30 din ya naya.
- **Example:** ek master ke neeche 6 naye accounts; har ek ne ₹300 se ₹1,000 deposit kiya aur casino me 15 se 34 guna jeeta.
- **Data:**
  - 16 fraud examples (14 users), 7 white labels, 7 masters
  - paisa ₹4.9 lakh (median ₹21,600)
  - saare accounts 30 din se naye (median 1.8 din)
  - aise data wale 65 requests me se agents ne 30 reject kiye (46%)
- **Detection:**
  - rule genuine requests me 0% pe lagta hai
  - model 90%+ pe 16/16
  - pattern chhupa ke test me 13/16

#### SPT-01: Back-lay, ya ek market me kai runners pe back (P3)
- **Definition:** player ek hi selection pe back aur lay dono lagata hai, ya ek market me 2 ya zyada runners pe back lagata hai. Isse use zyada stake ya kam risk wali position milti hai.
- **Platform reasons:**
  - "User doing back and lay very frequently" (182 rejects)
  - "Runner1 Back Runner2 Back" (19 rejects)
- **Data signals:**
  - 150 ya zyada selections pe back + lay
  - ya 80 ya zyada markets me 2+ runners pe back
  - ya 2 din se naya account aur 3+ markets me 2+ runners pe back
- **Data:**
  - in reasons wale 201 rejects (184 users), paisa ₹2.06 crore (median ₹5,500)
  - account age median 114 din; sirf 34% accounts 30 din se naye
  - inme se 38 training fraud examples hain; baaki labeling niyamon ki wajah se training se bahar hain (purana account, bina lock)
  - P3 ke 23 fraud examples: paisa ₹5.6 lakh, 87% naye accounts
- **Detection:**
  - fraud examples: model 60%+ pe 8/23, 40%+ pe 18/23
  - saare 201 rejects: model 60%+ pe sirf 46
  - genuine me bhi aise players hain: 267 genuine requests me 150+ selections pe back + lay hai, aur rule genuine ke 1.16% pe lagta hai
- **Kami:** sabse bada residual risk yahi hai (Section 4).

#### SPT-02: Casino me statement banana, phir sports jeet
- **Definition (platform ke shabdon me):** naya user casino me chhoti-chhoti bets lagata hai taaki statement ban jaye, phir sports me back-lay karke jeetta hai. Statement isliye banata hai taaki check na ho paye.
- **Platform reason:** "New User Bet in casino for Statement" (59 rejects).
- **Data signals:** naya account, casino me chhoti bets ki lambi list, uske baad sports me back + lay.
- **Data:**
  - 59 rejects (58 users), paisa ₹22.7 lakh (median ₹21,900)
  - account age median 21 din
  - 14 training fraud examples bane (zyadatar P1 ya P2 data ki wajah se)
- **Detection:** model 60%+ pe 30/59. Is type ka alag rule nahi hai.

#### SPT-03: Ground line betting
- **Definition:** player match ke ground se live jaankari leke bet lagata hai, TV ya data feed ki deri ka fayda uthata hai.
- **Platform reason:** "User is betting from ground" (44 rejects); remark "ground line" (3).
- **Data signals (jo chahiye):** bet ka time, aur event ke ball/score ka time. **Bets me time nahi aata**, isliye ye signal ban hi nahi sakta.
- **Data:** 45 rejects (44 users), paisa ₹64.8 lakh (median ₹10,100), account age median 43 din.
- **Detection:** None. Model 60%+ pe 12/45, sirf doosre signals ki wajah se.

#### SPT-04: Wrong odds aur late bets ka fayda
- **Definition:** platform ki galti ka fayda: galat odds, market der se suspend hona, "late no ball", galat result.
- **Platform reason:** "Late Suspended" (2 rejects).
- **Remarks:** "wrong odd", "bet reject due to rate" (26 rejects).
- **Bet-level reason** (sirf void/cancel hui bets pe aata hai): Wrong odd, Late Suspended, Late no ball, Over Not Completed, Reduced over, Wrong result, Technical issue, Cheating.
- **Data:** 28 rejects, paisa ₹19.4 lakh.
- **Label:** platform ki galti ko model ke liye **fraud nahi** maana jaata. Par jo user baar-baar aisi galtiyon ka fayda uthaye, uska risk alag hai aur abhi naapa nahi jaata.
- **Detection:** None. Platform agent bets void karke ise sambhalta hai. `requested_odds` aur `odds` ka farak feature me hai, par ye type pakadne ke liye bet ka time chahiye.

#### BON-01: Bina deposit bonus (P4)
- **Definition:** player bina deposit kiye sirf bonus se khelta hai aur jeet withdraw karta hai.
- **Data signals:** period me koi deposit nahi; bonus ₹300 ya zyada.
- **Data:**
  - 60 requests (58 users); bonus median ₹365 (signup bonus)
  - profit median ₹1,091
  - 3 reject hue; 1 training fraud example (₹365 bonus, ₹598 jeet)
- **Detection:** P4 rule. Bonus se chhoti jeet ka score jeet ke hisaab se seemit hai (Score aur Threshold Policy). Rejected 3 me se 2 model 60%+ pe.
- **Kami:** sirf 1 fraud example hai, isliye P4 ka score kamzor hai.

#### ACC-01: Ek master ke neeche account groups aur collusion
- **Definition:** ek master ke neeche 3 ya zyada alag users, 72 ghante ke andar, ek jaisa ajeeb behaviour dikhate hain (jaise ek jaisa deposit aur ek jaisi casino jeet).
- **Remark:** "group betting" (4 rejects, ₹2.1 lakh).
- **Data:**
  - Layer 3 ne 75 groups pakde: 1,559 requests, 1,165 users
  - 22 groups me kam se kam ek reject hai; groups me 78 rejects hain
  - groups me reject rate 5.0% hai; sab requests me 0.54%
- **Detection:** Layer 3 groups ("In a group of unusual users under the same master"). "Group betting" ke 4 me se 3 model 60%+ pe.
- **Kami:** Layer 3 ka galat alarm 0.80% hai, limit 0.6% se upar.

#### ACC-02: Multi-accounting (same IP)
- **Definition:** ek hi IP ya device se kai users, aksar ek hi market me ek jaisi bets.
- **Platform reason:** "Same IP Multiple User" (5 rejects); remark "same ip" (4).
- **Data:** 8 alag rejects, paisa ₹1.7 lakh.
- **Detection:** None. **IP aur device data nahi aata.** Model 60%+ pe 3/8, sirf doosre signals se.

#### PAY-01: Deposit karke kam khel ke withdraw
- **Definition:** player deposit karta hai, bahut kam ya bilkul nahi khelta, aur paisa withdraw kar leta hai. Ye paisa ghumane (money laundering) ka signal ho sakta hai.
- **Remark:** "no activity" (7 rejects; inme se 6 me 20 din ka betting data nahi tha).
- **Data:**
  - 770 requests me deposit hai, kul khel deposit se kam hai, aur withdrawal bhi hai; inme se 25 reject hue
  - 98 requests me deposit aur withdrawal hai par khel bilkul nahi; inme se 4 reject hue
- **Detection:** None. `turnover_to_dep` aur `dep_to_wd_fastest_min` features hain, par rule nahi hai.
- **Impact:** paisa kam hai, par AML (regulatory) risk hai.

#### NF: Reject ki doosri wajahein (fraud nahi)
| Code | Wajah | Rejects | Label |
|---|---|---|---|
| NF-01 | Platform ki galti: wrong odd, game tech issue, market opened by mistake | 48 | Not fraud |
| NF-02 | Chhoti rakam ("small amount") | 56 | Training se bahar |
| NF-03 | Wajah saaf nahi: "hold" (32), "." (19), "small amt" (14), agent ke naam, "checking" | 100 | Training se bahar |
| NF-04 | "no coin" (matlab platform se confirm karna hai) | 4 | Training se bahar |

---

## 4. Risk Register

**Column ka matlab:** L = Likelihood, I = Impact, Inh. = Inherent rating, Resid. = Residual rating.

### 4.1 Fraud Risks
| ID | Type | L | I | Inh. | Abhi ka control | Effect. | Resid. | Owner |
|---|---|---|---|---|---|---|---|---|
| R-01 | CAS-01 P1 | 4 | 5 | Critical (20) | P1 rule, Fraud %, review queue | Partial | High | MiraiGate data team |
| R-02 | CAS-02 P2 | 4 | 3 | High (12) | P2 rule, Fraud %, Layer 3 | Strong | Low | MiraiGate data team |
| R-03 | SPT-01 P3 | 5 | 5 | Critical (25) | P3 rule, "2+ runners" signal | Weak | Critical | MiraiGate + client risk |
| R-04 | SPT-02 statement banana | 5 | 4 | Critical (20) | Fraud % (alag rule nahi) | Partial | High | MiraiGate data team |
| R-05 | SPT-03 ground line | 5 | 5 | Critical (25) | Koi nahi | None | Critical | Platform (data) |
| R-06 | SPT-04 wrong odds / late | 4 | 4 | Critical (16) | Platform ka bet void process | None | Critical | Platform operations |
| R-07 | BON-01 P4 | 2 | 1 | Low (2) | P4 rule, bonus score limit | Strong | Low | MiraiGate data team |
| R-08 | ACC-01 groups | 4 | 4 | Critical (16) | Layer 3 groups | Partial | High | MiraiGate data team |
| R-09 | ACC-02 same IP | 3 | 2 | Medium (6) | Koi nahi | None | Medium | Platform (data) |
| R-10 | PAY-01 kam khel ke withdraw | 3 | 4 | High (12) | Koi nahi | None | High | Client compliance |

### 4.2 System aur Process Risks
| ID | Risk | Saboot | L | I | Inh. | Control | Resid. |
|---|---|---|---|---|---|---|---|
| R-11 | Reject ki wajah saaf nahi, isliye labels kam aur galat | 183 rejects (60%) "unknown"; paisa ₹1.6 crore | 5 | 4 | Critical | Labeling niyam, review list | High |
| R-12 | Score agent ke faisle ke baad aata hai | Data agent ke faisle ke median 1.8 second baad pahunchta hai | 5 | 4 | Critical | Koi nahi | Critical |
| R-13 | Data gaps: bet time, IP, device, status codes, amount | Data Contract dekhein | 5 | 4 | Critical | Koi nahi | Critical |
| R-14 | Purane account ka score kam karna | P1 ke 16/22 accounts 30+ din purane; SPT-01 rejects ki median age 114 din | 4 | 4 | Critical | Strong case me 95–98% ki ijazat | High |
| R-15 | Fraud examples kam (62; P4 me sirf 1) | Overfitting ka khatra | 4 | 3 | High | Simple model, chhupa ke test, tay disha wale wazan | Medium |
| R-16 | Reviewer decisions training me nahi jaate | Panel decisions abhi manual | 5 | 3 | Critical | Planned | Critical |
| R-17 | Galat alarm aur reviewer ka bojh | 24 din me 441 players 60%+ (~18 roz); genuine 90%+ pe 0.03% | 3 | 2 | Medium | Calibration, queue 60%+ | Low |
| R-18 | Model drift pe nazar nahi | Monitoring abhi manual | 3 | 3 | Medium | Sirf anomaly ka weekly report (Weak) | Medium |

### 4.3 Heat Map (Inherent)
| Likelihood ↓ / Impact → | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | | | R-16 | R-04, R-11, R-12, R-13 | R-03, R-05 |
| **4** | | | R-02, R-15 | R-06, R-08, R-14 | R-01 |
| **3** | | R-09, R-17 | R-18 | R-10 | |
| **2** | R-07 | | | | |
| **1** | | | | | |

---

## 5. Control Gaps aur Action Plan

| # | Action | Risk | Owner | Priority |
|---|---|---|---|---|
| 1 | SPT-01 ke 201 rejects client ke saath dekhna: purane account ke back-lay rejects ko fraud maanein ya nahi | R-03, R-14 | Client risk lead + MiraiGate | P0 |
| 2 | Platform request bante hi data bheje, faisle ke baad nahi | R-12 | Platform | P0 |
| 3 | Bets me placed time, IP/device, aur status codes ka matlab maangna | R-05, R-09, R-13 | Platform | P0 |
| 4 | Panel decisions ko training me jodna | R-11, R-16 | MiraiGate | P0 |
| 5 | Agents ke liye remark ki tay list (dropdown); "hold" ya naam akele nahi | R-11 | Client operations | P1 |
| 6 | Layer 3 ka galat alarm 0.6% ke andar laana (v5 vs v7 ka faisla) | R-08 | MiraiGate | P1 |
| 7 | PAY-01 ke liye rule ya report (client approval ke baad) | R-10 | MiraiGate + client compliance | P1 |
| 8 | SPT-02 ke liye "casino me chhoti bets, phir sports back-lay" signal | R-04 | MiraiGate | P1 |
| 9 | Ek user pe wrong-odds/late void bets ki ginti (bet time aane ke baad) | R-06 | MiraiGate | P2 |
| 10 | Weekly drift aur KRI report | R-18 | MiraiGate | P2 |

---

## 6. Key Risk Indicators (KRI)
Har hafte report hoga.

| KRI | Abhi (24 din) | Warning |
|---|---|---|
| Agent reject rate | 0.54% | 1% se upar |
| Data wale rejects jo model ke Normal band (0–19) me the | 125 / 277 (45%) | 50% se upar |
| Fraud examples jo model akele 60%+ pe pakde | 42 / 62 (68%) | 60% se neeche |
| Genuine requests 90%+ pe | 0.03% | 0.1% se upar |
| Review queue me roz naye players | ~18 | 40 se upar |
| Bina data ke requests | 1.8% | 5% se upar |
| Wajah saaf nahi wale rejects | 60% | 50% se upar (target neeche laana) |
| Layer 3 galat alarm | 0.80% | 0.6% se upar |

---

## 7. Taxonomy aur Assessment ka Update

- **Har mahine:** saare numbers naye data se update honge; client risk lead aur MiraiGate milke review karenge.
- **Naya fraud type kab judega:**
  - platform nayi reason category jode, ya
  - panel me 3 ya zyada alag users ek hi naye pattern naam se fraud mark hon, ya
  - client risk team naya type bataye.
- **Approval:** naya type aur uska rule client ki approval ke baad hi score me lagega.
- **Version:** har update pe version aur date badlegi, aur badlav ki list neeche jodi jayegi.

---

## Appendix A: Agent Remark → Taxonomy
| Remark me shabd | Remark type | Taxonomy |
|---|---|---|
| "casino checking", "casino ... voided" | casino_checking | CAS-01 / CAS-02 |
| "cheat", "cheater", "suspicious" | cheat | CAS, SPT-01, BON (data dekh ke) |
| "void", "bet void", "void hoga" | bet_void | Data dekh ke |
| "wrong odd", "mistake", "game tec issue", "tech", "void done" | platform | NF-01 / SPT-04 |
| "rate" | rate | SPT-04 |
| "ground" | ground_line | SPT-03 |
| "ip" | same_ip | ACC-02 |
| "group betting" | (no_reason) | ACC-01 |
| "no activity" | no_activity | PAY-01 |
| "small amount" | small_amount | NF-02 |
| "no coin" | no_coin | NF-04 |
| "hold", ".", "checking", agent ka naam | no_reason | NF-03 |

## Appendix B: Platform Reason → Taxonomy
| cat | reason | Platform ka description (short) | Rejects | Taxonomy |
|---|---|---|---|---|
| bet | Reason 1 | User doing back and lay very frequently | 182 | SPT-01 |
| statement | New User Bet in casino for Statement | Casino me chhoti bets se statement, phir sports back-lay | 59 | SPT-02 |
| bet | Reason 2 | User is betting from ground | 44 | SPT-03 |
| bet | Runner1 Back Runner2 Back | Ek market me do runners pe back | 19 | SPT-01 |
| bet | Same IP Multiple User | Same IP se same market me same type ki bets | 5 | ACC-02 |
| bet | Late Suspended | Market der se suspend hua, user ne bet laga di | 2 | SPT-04 |
