# Reviewer SOP (Case Management)
# Fraud Review Panel

| Item | Detail |
|---|---|
| Document | Reviewer Standard Operating Procedure |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Kiske liye | Client ke reviewers aur lead reviewer |
| Panel | `https://review-panel.api.savage1.one` |
| Related documents | Reason Code Catalogue; Score aur Threshold Policy; Labeling aur Ground-Truth Policy; Fraud Risk Assessment aur Taxonomy |

---

## 1. Purpose

Reviews ek jaise honge to labels bhi ek jaise banenge, aur model sahi seekhega. Ye SOP batata hai:
- panel me roz ka kaam
- case kaise padhein
- kab Fraud aur kab Not fraud chunein
- pattern wala sawaal kaise answer karein
- reason kaise likhein
- lead reviewer tak kab le jaayein

**Yaad rakhein:**
- Score sirf salah hai, saboot nahi. Faisla aapka hai, aur wo statements aur bets ke data pe hona chahiye.
- Aapka har decision agle model update me training me jaata hai. Ek galat decision model ko galat sikhata hai.

---

## 2. Roz ka Kaam

1. **Sign in karein.** Apna hi account. Ek account ek browser me hi chalta hai; doosre browser me sign in karne pe pehla sign out ho jaata hai.
2. Sidebar me **"Model updated"** aur **"Data up to"** ki date dekhein. Data 2 din se purana lage to lead reviewer ko batayein.
3. **Review queue → Waiting** kholein.
4. Is order me review karein:
   1. **Very high (90–99)**: 4 ghante ke andar
   2. **High (60–89)**: 24 ghante ke andar
   3. **Spot check** (60 se neeche, random; jab ye feature aayega): 7 din ke andar
5. Har player pe Section 3 ke steps.
6. Din ke end me Waiting me sabse purana player 24 ghante se purana na ho.

---

## 3. Case Kaise Padhein

### Step 1: Upar ki line
Score aur band, agent ka decision, request time, account age, deposits, withdrawn, profit, casino share, bonus.

**Pehle sawaal:**
- Account kitna naya hai?
- Deposit ke mukable jeet kitni hai?
- Khel casino me hai ya sports me?

### Step 2: Why this score
- **Main reasons:** score kyun badha. Har line ka matlab Reason Code Catalogue me hai.
  - Pehli line agar "Rejected by agent, remark: …" hai, to ye request training ka fraud example hai. Score me 95% minimum laga hai. Phir bhi data khud dekhein.
- **Known pattern** box: request kis pattern (P1–P4) jaisi hai aur rule ki shartein.
- **Account older than 30 days** note: purane account ka score jaan-boojh ke kam rakha jaata hai.
- **Different from normal users:** kya cheez normal se alag hai. Alag hona fraud nahi hai.
- **Agent remark / Platform reason:** agent aur platform ne kya likha.

### Step 3: Statements
Ye wahi entries hain jinpe score bana (request se pehle ke ~20 din).

| Filter | Kya dekhein |
|---|---|
| Deposits | Kitne deposit, kitne bade, kab |
| Withdrawals | Pehle kitna nikala; deposit ke kitni der baad |
| Bonus | Bonus mila? Deposit ke bina? |
| Casino | Kitni entries; kuch games me bahut badi jeet? Chhoti-chhoti bets ki lambi list? |
| Sports | Settled jeet/haar |

**NA** ka matlab: data me ye entries nahi aayi.

### Step 4: Bets
| Kya dekhein | Kaise |
|---|---|
| Same selection pe back aur lay | Back / Lay filter; same market aur selection |
| Ek market me kai runners pe back | Market filter |
| Rate maange se alag | "asked" odds |
| Bade stakes | Stake column |

**Dhyan dein:**
- Bets me time nahi aata; order platform ki numbering ka hai.
- P/L aur liability us rate pe banne wali rakam hai, settled result nahi. Settled result statements me hai.

### Step 5: Other requests
- Isi user ki baaki requests: pehle reject hui? Wahi data pehle approve hua?
- Same data kai baar approve hua ho aur ab sirf "hold" se reject, to ye fraud ka saboot nahi.

### Step 6: Account group (agar `G<n>` hai)
Account groups page pe group kholein. Same master ke doosre users ka data milta-julta hai? Ek jaisa chhota deposit aur badi casino jeet group fraud ka signal hai.

---

## 4. Kab Fraud, Kab Not Fraud

### 4.1 Fraud ke Signals (pattern ke hisaab se)
| Pattern | Fraud tab maanein jab | Dhyan |
|---|---|---|
| P1 Casino me asaadharan jeet | Zyadatar khel casino me; jeet deposit ki kai guna; kuch games me asaadharan multiplier; casino provider ki checking me galat nikla | Bade genuine casino winners bhi hote hain. Normal bet size aur lambi history wale ko seedha fraud na kahein |
| P2 Chhota deposit, badi casino jeet | Naya account, ek chhota deposit (≤ ₹1,000), 10 guna+ jeet; same master ke aur aise accounts | Ek akela case kam pakka; group ho to zyada |
| P3 Back-lay / kai runners | Same selections pe baar-baar back + lay, ya kai runners pe back, khaaskar naye account me aur bonus/rate ka fayda | Kuch genuine traders hedge karte hain. Pattern baar-baar aur systematic ho tab fraud |
| P4 Bina deposit bonus | Bina deposit sirf bonus se jeet, aur kai accounts ek jaise | ₹1–2k ki chhoti jeet akele aam taur pe fraud nahi |
| Group (Layer 3) | Same master ke kai users ka ek jaisa behaviour, 72 ghante me | Group ke baaki users bhi dekhein |
| Ground line, same IP | Platform ka reason ho aur data bhi saath de | Bet time aur IP data me nahi hain; platform ki jaankari pe nirbhar |

### 4.2 Not Fraud kab
- Platform ya game ki galti (wrong odds, technical issue, market galti se khula). Reason: "Platform or game error".
- Normal bet sizes se genuine jeet.
- Purana account, normal history, koi pattern nahi.
- Chhoti bonus jeet, koi aur signal nahi.

### 4.3 Pakka na ho to
- Andaze se decision mat dein. Player ko **Waiting** me rehne dein.
- Lead reviewer ko user code bhej ke poochein (Section 8).
- Low score ka matlab genuine nahi. Data me saaf fraud dikhe to Fraud chunein, chahe score kam ho.

---

## 5. Review Box (right side)

1. **Fraud** ya **Not fraud** chunein.
2. **Pattern ka sawaal** (sirf jab request kisi known pattern se mile): "Does it fit this request?"

| Answer | Kab chunein | Text |
|---|---|---|
| Yes, it fits | Pattern ka rule is request pe sahi baithta hai | Nahi chahiye |
| No, it does not fit | Pattern galat laga hai | Nahi chahiye |
| Other | Kuch aur hai, ya naya pattern hai | Zaroori: chhota naam + ek line description, jaise "bonus group: ek master ke kai naye accounts, sirf bonus se jeet" |

   - Sawaal optional hai, par jawab dena model ke liye bahut kaam ka hai.
   - Naye pattern ke liye **har baar wahi naam** likhein. 3 alag users same naam pe aayein to naya rule propose hota hai.
3. **Reason likhein** (Section 6).
4. **Submit**, ya **Submit and open next**.
5. Notification batayega ki kya save hua aur ki ye agle model update me training me jayega.

**Decision badalna:** player kholein → Change → naya decision aur reason → Submit. Purana decision history me rehta hai. Hatana bhi history me "cleared" ke roop me rehta hai.

---

## 6. Reason Kaise Likhein

**Achha reason:** data se, short, specific (3 se 600 characters).

| Achha | Kharab |
|---|---|
| "1 deposit ₹500, casino jeet ₹21,000 (42 guna), account 1 din; same master ke 3 aur aise accounts" | "hold" |
| "48 selections pe back aur lay, account 2 din, bonus ke baad" | "." |
| "Wrong odds wali bets; platform ne void ki; baaki khel normal" | "checking" |
| "Purana account (2 saal), normal stakes, jeet ek bade match se" | Sirf apna naam |

Quick reason chips se shuru kar sakte hain, phir data jodein. Reason platform ko wapas jaata hai aur training me use hota hai.

---

## 7. Baaki Pages

| Page | Kab use karein |
|---|---|
| Decisions | Apne aur team ke faisle dekhna; filter Fraud / Not fraud; CSV sirf platform ko bhejne ke liye |
| Withdrawal requests | Kisi user, master, remark, group (`G24`) ya pattern (`P2`) ko dhoondhna |
| Account groups | Group ke saare users ek saath dekhna |
| Known patterns | Har pattern kya check karta hai; pakde gaye requests; **notes** likhna jab aap pattern ke baare me kuch naya dekhein (jaise "P2 ab ₹300 deposit se bhi aa raha hai") |

---

## 8. Lead Reviewer tak Kab Le Jaayein

| Situation | Kya karein |
|---|---|
| Pakka nahi pata | Player Waiting me; lead reviewer ko user code aur sawaal |
| Doosre reviewer ka ulta decision dikha | Badalne se pehle lead reviewer se baat |
| Bahut badi rakam (₹1 lakh se zyada profit) | Fraud ya Not fraud se pehle lead reviewer ki nazar |
| Naya pattern jaisa lage | "Other" me naam likhein aur lead reviewer ko batayein |
| Panel ka data galat lage (jaise statements khaali par user ne khela) | Lead reviewer → MiraiGate |
| Panel nahi khul raha, ya bar-bar sign-out | Lead reviewer → MiraiGate support |

Lead reviewer har hafte takraav wale cases ka faisla karta hai.

---

## 9. Kya Karein, Kya Na Karein

| Karein | Na karein |
|---|---|
| Apna account, apna password | Account share karna |
| Shared computer pe Sign out | Password chat ya email me bhejna |
| Chat me masked user code (jaise `a1b***`) | Screenshots ya data panel ke bahar bhejna |
| CSV sirf platform ko | CSV aur exports apne computer pe rakhe rehna |
| Data dekh ke decision | Sirf score dekh ke decision |

---

## 10. Quality

- **Har hafte:** lead reviewer 10 random decisions dobara dekhta hai aur takraav ki list suljhata hai.
- **Har mahine:** reviewers aur MiraiGate milke dekhte hain ki kahan faisle alag-alag the, aur is SOP me kya badalna hai.
- **Naya reviewer:** pehle 20 decisions lead reviewer ke saath.

---

## 11. Roz ki Checklist

- [ ] Sign in, "Data up to" ki date check
- [ ] Very high players 4 ghante me
- [ ] High players 24 ghante me
- [ ] Har decision ke saath data wala reason
- [ ] Known pattern pe Yes / No / Other
- [ ] Pakka na ho to Waiting + lead reviewer
- [ ] Din ke end me Waiting ka sabse purana < 24 ghante
- [ ] Sign out (shared computer pe)

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
