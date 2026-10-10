# Reason Code Catalogue
# Fraud Review Panel: "Why this score"

| Item | Detail |
|---|---|
| Document | Reason Code Catalogue |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Model version | Fraud % model, 8 Oct 2026; anomaly model v5 |
| Related documents | Score aur Threshold Policy; Model Cards; Reviewer SOP |

---

## 1. Purpose

Reviewer aur client ko samajh aana chahiye ki request ka score zyada kyun aaya. Ye catalogue panel me dikhne wali har wajah ki line ka matlab batata hai:
- wo line kab aati hai
- reviewer use kaise padhe

Panel ka saara text English me hai. Is document me har line English me hi likhi gayi hai, jaise panel me dikhti hai.

---

## 2. Request Page pe Kahan Kya Dikhta Hai

| Jagah | Kya hai | Code range |
|---|---|---|
| **Main reasons** | Score ki wajahein (label line, known pattern, 3 tak behaviour, seema), sabse ahem pehle | RC-L, RC-P, RC-B, RC-S, RC-N |
| **Known pattern** box | Request kis known pattern se milti hai, aur pattern ka rule | RC-P |
| **Account older than 30 days** note | Purane account ka score niyam | RC-I01 |
| **Different from normal users** | Anomaly model ke hisaab se kya normal se alag hai (Unusual score 97+ pe) | RC-U |
| **Agent remark / Platform reason** box | Agent ka remark aur platform ki reason list, jaise aaye | RC-I02 |
| **Signals** | Pattern score, Unusual score, Account group, Training label | Section 7 |

---

## 3. Main Reasons

### 3.1 Kaise Chuni Jaati Hain
1. **Label wali line (RC-L):** request training ka fraud example ho, ya us user ki pehle wali request fraud example ho, to ye sabse pehle aati hai.
2. **Known pattern (RC-P):** model ke known pattern wale hisse ka % 50 ya zyada ho to.
3. **Behaviour (RC-B):** model me jin signals ne score sabse zyada badhaya, unme se **3 tak**:
   - sirf wahi signal jiska asar ek tay limit (0.2) se upar ho aur value 0 se zyada
   - "Casino winnings far above deposits" aaye to "Winnings far above deposits" nahi dikhti (dono ek hi baat)
4. **Seema (RC-S):** bonus wala niyam laga ho to uski line.
5. Kuch bhi na ho to **"Looks normal"** (RC-N01).

Ye lines score ko **badhane** wali cheezein hain. Ye fraud ka saboot nahi hain. Reviewer ko statements aur bets se confirm karna hai.

### 3.2 Label Lines (RC-L)
| Code | Panel ka text | Kab aata hai | Reviewer kaise padhe |
|---|---|---|---|
| RC-L01 | Rejected by agent, remark: *<remark>* | Ye request training ka fraud example hai aur agent ne ise reject kiya tha | Score me training ka 95% minimum laga hai (Score Policy, Section 7). Agent ka remark padhein aur data dekhein |
| RC-L02 | Rejected by agent, no remark | Upar jaisa, remark khaali ya sirf "." | Upar jaisa |
| RC-L03 | Approved by agent, remark: *<remark>*; used as a fraud example after data review | Agent ne approve kiya tha, par data review me ise fraud example maana gaya | Review list ka case (Labeling Policy, Section 7) |
| RC-L04 | Earlier request rejected by agent, remark: *<remark>* | Isi user ki pehle wali request training ka fraud example thi | 95% minimum sirf pehli request ki wajah se laga hai. Is request ka data alag se dekhein |
| RC-L05 | Earlier request used as a fraud example after data review | Upar jaisa, pehli request approved thi | Upar jaisa |

Panel kabhi "Confirmed fraud" nahi likhta. Fraud confirm karna client ka kaam hai.

### 3.3 Known Pattern (RC-P)
| Code | Panel ka text | Kab aata hai |
|---|---|---|
| RC-P01 | Matches known pattern P1 | Request P1 jaisi hai: unusual casino play or winnings |
| RC-P02 | Matches known pattern P2 | Small deposit, then 10 times or more in casino winnings |
| RC-P03 | Matches known pattern P3 | Back and lay, or backing several runners in a market |
| RC-P04 | Matches known pattern P4 | Bonus with no deposit |

Known pattern box me rule ki shartein likhi hoti hain. Reviewer Review box me bata sakta hai ki pattern is request pe fit hota hai ya nahi: **Yes / No / Other**.

### 3.4 Behaviour (RC-B)
"Wazan" ka matlab: model me signal ka asar kitna hai. Zyada wazan = score pe zyada asar.

| Code | Panel ka text | Signal | Kab aata hai | Wazan (8 Oct) |
|---|---|---|---|---|
| RC-B01 | Very different from normal users | Unusual score | Anomaly model ke hisaab se request normal users se bahut alag | +2.06 |
| RC-B02 | Backed 2+ runners in a market | 2+ runners pe back | Kai markets me ek se zyada runner pe back | +1.26 |
| RC-B03 | Large winnings | Kul jeet | Window me badi jeet (casino + sports) | +0.73 |
| RC-B04 | Among the top 1–3% most unusual | Unusual score 90+ | Unusual score 90 se upar | +0.64 |
| RC-B05 | Winnings far above deposits | Jeet / deposit | Jeet deposit ki kai guna | +0.62 |
| RC-B06 | New account (under 7 days) | Account age | Account 7 din se naya | +0.29 |
| RC-B07 | Mostly casino play | Casino share | Zyadatar entries casino ki | +0.21 |
| RC-B08 | Profit with no deposit | Bina deposit profit | Window me deposit nahi, phir bhi profit | +0.14 |
| RC-B09 | Bonus with no deposit | Bina deposit bonus | Window me deposit nahi, bonus mila | +0.11 |
| RC-B10 | In a group of unusual users under the same master | Account group | Request Layer 3 ke kisi group me hai | +0.09 |
| RC-B11 | Casino winnings far above deposits | Casino jeet / deposit | Casino jeet deposit ki kai guna | +0.04 |
| RC-B12 | Large wins from small stakes | Jeet / stake | Abhi ke model me wazan 0, isliye nahi dikhti | 0 |
| RC-B13 | Back and lay on the same selection | Back + lay | Abhi ke model me wazan 0, isliye nahi dikhti (P3 aur RC-B02 se pakda jaata hai) | 0 |

Har retrain pe wazan badal sakte hain. Kisi signal ka wazan kabhi minus nahi hota, siwaye "haar" (loss) ke, jo score sirf ghata sakta hai.

### 3.5 Seema (RC-S)
| Code | Panel ka text | Kab aata hai |
|---|---|---|
| RC-S01 | Small win from a bonus with no deposit, so the score is kept lower | Bina deposit, bonus se chhoti jeet; score jeet ke hisaab se seemit (Score Policy, Section 6) |

### 3.6 Normal (RC-N)
| Code | Panel ka text | Kab aata hai |
|---|---|---|
| RC-N01 | Looks normal | Koi signal limit se upar nahi |

**Dhyan dein:** 20% se neeche ke scores pe bhi behaviour lines dikh sakti hain (abhi 49,613 requests me). Inhe kam score pe hatane ka proposal Open hai.

---

## 4. Info Notes (RC-I)

| Code | Panel ka text | Kab aata hai |
|---|---|---|
| RC-I01 | Account older than 30 days. Older accounts get a lower score. They reach 90% or more only in very strong cases, and then only between 95% and 98%. | Account request ke time 30 din se purana |
| RC-I02 | Agent remark: … / Platform reason: … | Hamesha; platform jo bheje wahi |

---

## 5. Different from Normal Users (RC-U)

**Kab dikhta hai:** Unusual score **97 ya zyada** ho tab.

**Kaise bante hain:**
- har feature ki value approved requests se milaayi jaati hai
- jo features approved ke top 5% ya bottom 5% me hon, unme se sabse alag **3** dikhaye jaate hain
- "{v}" ki jagah asli value aati hai (₹ Indian format me, ya %)

| Code | Text | Matlab |
|---|---|---|
| RC-U01 | no deposit | Window me deposit nahi (deposit wali sab lines ki jagah ek hi line) |
| RC-U02 | account only {v} days old / account less than 1 day old | Account bahut naya |
| RC-U03 | only {v} days of data / less than 1 day of data | Data window bahut chhota |
| RC-U04 | bonus of ₹{v} / bonus very high compared with deposits / {v} bonuses | Bonus normal se zyada |
| RC-U05 | only {v} deposits / very small deposit of ₹{v} / very large deposit of ₹{v} | Deposit normal se alag |
| RC-U06 | won far more than the deposits / won far more than the deposits in casino / won far more than the casino stake | Jeet ka anupaat bahut ooncha |
| RC-U07 | lost far more than deposited / lost more than the deposits in casino | Haar bahut zyada |
| RC-U08 | casino winnings of ₹{v} / won ₹{v} in casino / staked ₹{v} in casino / largest casino bet ₹{v} / average casino bet ₹{v} / {v} casino entries / lost ₹{v} in casino | Casino ki rakam normal se alag |
| RC-U09 | {v} of play in casino | Casino share bahut zyada |
| RC-U10 | back and lay on {v} selections / back and lay on {v} of selections | Back + lay bahut zyada |
| RC-U11 | backed 2+ runners in {v} markets / {v} bets in one market | Ek market me bahut bets |
| RC-U12 | {v} of bets placed at different odds than asked | Rate maange se alag |
| RC-U13 | very high odds ({v}) / very high return on bets / won almost every bet / won {v} of sports bets | Bets pe asaadharan jeet |
| RC-U14 | largest bet ₹{v} / average bet ₹{v} / bet size changes a lot / very large total stakes | Bet size normal se alag |
| RC-U15 | mostly lay bets / mostly bookmaker market / mostly fancy market / mostly match odds | Market ka tareeka alag |
| RC-U16 | {v} bets / played {v} markets / played {v} matches / very many sports bets / {v} sports settlements | Bahut zyada betting |
| RC-U17 | {v} of play between midnight and 6 am | Raat ka khel zyada |
| RC-U18 | {v} entries per day / very low activity / played on only {v} days / played on {v} days / activity spread over many days / {v} statement entries / only {v} statement entries | Activity normal se alag |
| RC-U19 | withdrawal only {v} minutes after deposit / withdrawal within {v} minutes of a deposit | Deposit ke turant baad withdrawal |
| RC-U20 | withdrawal {v} minutes after last play / withdrawal right after last play / withdrawal long after the last deposit / long gap between deposit and withdrawal | Withdrawal ka time alag |
| RC-U21 | withdrawals of ₹{v} / {v} withdrawals / few earlier withdrawals / no withdrawals / withdrew ₹{v} more than deposited / withdrew far less than deposited | Withdrawals normal se alag |
| RC-U22 | total winnings ₹{v} / total loss ₹{v} / largest win ₹{v} / no large win / won ₹{v} on bets / lost ₹{v} on bets / won ₹{v} on sports / lost ₹{v} on sports / largest sports win ₹{v} | Jeet ya haar ki rakam |
| RC-U23 | balance ₹{v} / balance only ₹{v} / balance reached ₹{v} / balance never above ₹{v} | Balance normal se alag |
| RC-U24 | played far more than the deposits / deposit barely used for play | Khel aur deposit ka anupaat |
| RC-U25 | very many deposits / very old account | Normal se zyada |
| RC-U26 | several small differences from normal users together | Koi ek cheez bahut alag nahi, par kai chhoti cheezein milke |

**Reviewer kaise padhe:** ye lines batati hain ki request **kaise alag** hai, ye nahi ki fraud hai. Jaise "very large deposit" ya "lost far more than deposited" bhi yahan aa sakte hain. Inse score sirf "Very different from normal users" (RC-B01) ke through badhta hai.

---

## 6. Bands

| Panel | Score | Matlab |
|---|---|---|
| Very high | 90–99 | Approved requests me se sirf 0.1% itne upar |
| High | 60–89 | Top 1%; review queue |
| Medium | 40–59 | Top 3% |
| Low | 20–39 | Top 10% |
| Normal | 0–19 | Baaki |
| No betting data | – | Score nahi bana |

---

## 7. Signals

| Panel | Range | Matlab |
|---|---|---|
| Pattern score | 0–99 | Known pattern se kitna milta hai. 50+ ka matlab rule laga |
| Unusual score | 0–99 | Approved requests me se kitne % isse kam alag hain. 97+ pe "Different from normal users" dikhta hai |
| Account group | `G<n>` ya – | Layer 3 group; Account groups page pe khulta hai |
| Training label | Section 7.1 | Training me request ka label |
| Requests from this user | Number | Is user ki kul requests |

### 7.1 Training Label
| Panel ka text | Matlab |
|---|---|
| Fraud example in training | Model ne ise fraud example ki tarah seekha |
| Genuine (approved) | Genuine example |
| Rejected, platform error | Agent reject, platform ki galti; fraud nahi |
| Rejected, reason not confirmed | Agent reject, wajah data se confirm nahi hui; training se bahar |
| Watch: user also has a rejected request | Approved, par isi user ka reject bhi hai |
| Watch: bonus with no deposit | Approved, bina deposit bonus |
| Watch: same-master cluster | Approved, same master ke kai naye P2 jaise accounts |
| Watch: approved, data like P2 | Approved, data P2 rule jaisa |
| No betting data | Bets aur statements nahi |

---

## 8. Naya Reason Code Kaise Judega

1. Naya signal ya niyam model me aaye to uska code, English text aur matlab is catalogue me pehle likha jaye.
2. Panel ke text me koi Hinglish ya internal shabd na ho.
3. Panel data build ke time jis line ka English text nahi milta, wo report hoti hai. Proposal: aisi line release ko roke.
4. Version aur change log update ho.

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
