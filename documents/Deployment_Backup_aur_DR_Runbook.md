# Deployment, Backup aur Disaster Recovery Runbook
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Deployment, Backup aur DR Runbook |
| Version | 1.1 (review ke liye draft) |
| Date | 14 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Kaun use karega | MiraiGate admin |
| Related documents | System Architecture Document; MongoDB Replica Set SRS; Incident Response Playbook; Access Control aur Security Design |

**Placeholders:**
- `<server address>`, `<key.pem>`, `<bucket>` ki jagah asli values admin ke paas hain. Wo is document me kabhi nahi likhi jaati.
- Passwords chat, email ya documents me kabhi nahi bheje jaate.

---

## 1. Kya Bachana Hai

| Data | Kahan | Dobara ban sakta hai? | Kitna ahem |
|---|---|---|---|
| `review.db` (decisions, history, pattern answers, notes) | Panel server `/opt/fraud-panel/data/` | **Nahi** | Sabse ahem |
| `users.db` (accounts, sessions, sign-in log) | Panel server, same folder | Accounts dobara ban sakte hain; sign-in history nahi | Ahem |
| Live data: replica set `fraud` DB (`surveillance`, `bets`, `statements`) | MongoDB replica set, Singapore: 2 data servers | Doosre server pe live copy hai; dono gayein to snapshot (3 din) ya platform dobara likhe | Ahem (60 din ka data) |
| Temporary ingest MongoDB `risk_events`, `user_data` | Ingest server, Docker volume `mongo_data` | Sirf agar platform dobara bheje | Ahem |
| JSON exports | Workstation | MongoDB se | Medium |
| `dashboard.json`, `activity.db` | Panel server + workstation | Haan, `build_data.py` se (~5–6 min) | Kam |
| Models aur datasets | Workstation | Haan, code + exports se | Medium |
| Code | Workstation / repository | Haan | Medium |

---

## 2. Zaroori Cheezein (Admin ke Paas)

- Panel server ki SSH key aur address (SSH sirf admin ke IP se khula)
- Ingest server ki SSH key aur address
- Domain ka DNS aur front proxy ka access
- S3 bucket ka naam; panel server pe IAM role jisme bucket pe `s3:PutObject` ho
- Ingest service ki API key aur MongoDB password (sirf server ki `.env` me)
- Replica set: teeno servers ki SSH key (`mongo-key`), `betting-data-ingest.prime1.one` ke DNS ka access, aur AWS Secrets Manager (`mongo/*`: passwords, keyFile, CA key)

---

## 3. Panel: Procedures

### P-01: Pehli Baar Setup (naya server)
**Shart:** Ubuntu 22.04/24.04, t3.medium, 40 GB gp3.

**Security group:**
- 443 aur 80 sab ke liye (80 sirf redirect)
- 22 sirf admin ke IP se
- 8080 band

1. Panel folder server pe bhejo (Windows se):
```powershell
scp -i <key.pem> -r panel ubuntu@<server address>:~/
```
2. Server pe setup chalao. Domain ke aage proxy/CDN HTTPS deta hai, isliye email nahi diya:
```bash
sudo bash ~/panel/deploy/setup_server.sh review-panel.api.savage1.one - <bucket>
```
3. Reviewer accounts banao (har ek ka password do baar poochha jayega):
```bash
sudo fraud-panel-users add User1 User2 User3 User4 User5 User6
```
4. Data bhejo (P-03) aur check karo (P-05).

**Setup script kya karti hai:**
- packages aur automatic security updates
- time zone Asia/Kolkata
- 2 GB swap
- `panel` system user
- `/opt/fraud-panel`, Python venv
- systemd service
- nginx (sign-in rate limit, security headers)
- optional certbot
- `review.db` ka roz S3 backup (bucket diya ho to)

Script dobara chalana safe hai: decisions aur accounts nahi chhuti.

### P-02: Reviewer Accounts
```bash
sudo fraud-panel-users list
```
```bash
sudo fraud-panel-users add <name>
```
```bash
sudo fraud-panel-users passwd <name>
```
```bash
sudo fraud-panel-users remove <name>
```
- Password badalne pe us user ka session khatam ho jaata hai.
- Account hatane ka faisla Access Control aur Security Design ke process se hota hai.

### P-03: Code aur Data ka Update
**Pehle backup lo** (P-07 ke liye):
```bash
sudo cp -a /opt/fraud-panel /opt/fraud-panel.prev
```
Phir Windows se, panel folder me:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\push_update.ps1 -Key <key.pem> -Server ubuntu@<server address>
```
- Sirf code badla ho to aakhir me `-CodeOnly` jodo.
- Script `server.py`, `accounts.py`, `requirements.txt`, `web/` aur (bina `-CodeOnly` ke) `activity.db`, `dashboard.json` bhejti hai.
- Server pe `fraud-panel-install-update` files lagati hai aur service restart karti hai.
- `review.db` aur `users.db` kabhi copy ya overwrite nahi hote.
- Browser naye files khud leta hai (versioned links); reviewers ko `Ctrl+F5` ki zarurat nahi.

### P-04: Retrain aur Panel Data Build (workstation, abhi manual)
1. Naya export `fraud_ingest/data/` me rakho aur `prepare.py` ki `SOURCES` list me jodo.
2. Is order me chalao:
```bash
python pattern_detection/data_prep/prepare.py
```
```bash
python pattern_detection/rules/step4_rules.py
```
```bash
python pattern_detection/scoring/step5_score.py
```
```bash
python pattern_detection/testing/step6_test.py
```
```bash
python new_pattern_detection/system/step6_weekly_update.py
```
```bash
python fraud_score/1_train.py
```
```bash
python fraud_score/2_score.py
```
Aakhri step panel folder (`dashboard_github/fraud_detection/panel`) ke andar se:
```bash
python build_data.py --workspace D:/fraud_detection
```
3. Har step ki `summary.txt` / report dekho. Numbers pichhle run se bahut kharab hon to release mat karo.
4. P-03 se bhejo.

### P-05: Health Check
```bash
systemctl status fraud-panel --no-pager
```
```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/login
```
```bash
journalctl -u fraud-panel -n 50 --no-pager
```
```bash
sudo nginx -t
```
- Browser me domain kholo, sign in karo, aur sidebar me "Model updated" aur "Data up to" ki date dekho.

### P-06: Restart
```bash
sudo systemctl restart fraud-panel
```
```bash
sudo systemctl reload nginx
```

### P-07: Panel Rollback (code ya data)
P-03 se pehle liya backup wapas lagao:
```bash
sudo systemctl stop fraud-panel
sudo rsync -a --exclude data/review.db --exclude data/users.db /opt/fraud-panel.prev/ /opt/fraud-panel/
sudo systemctl start fraud-panel
```
`review.db` aur `users.db` rollback me nahi badalte. Automation (Phase 2) ke baad rollback release agent se ek step me hoga.

### P-08: Anomaly Model Rollback
```bash
python new_pattern_detection/system/step6_weekly_update.py --wapas <version>
```
Versions `new_pattern_detection/system/models/versions/` me hain (jaise `v5_20261001_1552`). Iske baad P-04 ke steps 6–8 aur P-03 chalao.

---

## 4. Ingest Service: Procedures

### I-01: Deploy ya Update
```bash
cd ~/fraud_ingest && docker compose up -d --build
```
### I-02: Health aur Logs
```bash
docker compose ps
```
```bash
curl http://localhost:8090/health
```
```bash
docker compose logs --tail 100 api
```
### I-03: Restart
```bash
docker compose restart api
```
- `docker compose down` se data volume safe rehta hai.
- Reboot ke baad containers apne aap chalte hain (`restart: unless-stopped`; `systemctl enable docker` ek baar).

---

## 4A. Live Data: MongoDB Replica Set (Singapore)

Create karne ke poore steps MongoDB Replica Set SRS, Section 11 me hain. Yahan sirf roz ke kaam.

### M-01: Health
Kisi data server pe SSH karke, `admin` user se:
```bash
mongosh "mongodb://localhost:27017/admin?tls=true&tlsCAFile=/etc/mongodb/tls/ca.pem" -u admin --eval 'rs.status().members.map(m => [m.name, m.stateStr, m.health])'
```
Ek PRIMARY, ek SECONDARY aur ek ARBITER dikhna chahiye, sab `health: 1`. Lag dekhne ke liye `rs.printSecondaryReplicationInfo()`.

### M-02: Ek Server Gira
- Primary gira: 10–12 second me doosra data server apne aap primary ban jaata hai. Kuch nahi karna; platform ka driver khud naye primary pe likhta hai.
- Secondary ya arbiter gira: likhna chalta rehta hai. Alert aayega.
- Dono case me gira hua server theek karo (EC2 console: status checks, reboot). Wapas aane pe woh khud secondary ban ke oplog se baraabar ho jaata hai (oplog 48 ghante ka hai).
- Koi data server 24 ghante se zyada band rahe to uske votes 0 aur priority 0 kar do (MongoDB Replica Set SRS, OPS-06); wapas aane pe 1, 1.

### M-03: OS ya MongoDB Update
Ek-ek karke, is order me: arbiter → secondary → primary. Primary se pehle `rs.stepDown()` chalao, 15 second ruko, phir update. Har server ke baad M-01.

### M-04: Teesra Data Server Jodna
MongoDB Replica Set SRS, Section 10. Downtime nahi hota.

---

## 5. Backups

| Kya | Kaise | Kab | Kahan | Rakhna | Status |
|---|---|---|---|---|---|
| `review.db` | `backup-review-db` (SQLite `.backup`, phir S3) | Roz 23:30 IST (cron) | `s3://<bucket>/review-db/review_<YYYYMMDD_HHMM>.db` | 90 din (S3 lifecycle, proposal) | Script bana hua; live pe bucket aur IAM role confirm karna hai |
| `users.db` | Same script me jodna hai | Roz 23:30 IST | `s3://<bucket>/users-db/` | 90 din | **Gap: abhi backup nahi** |
| Panel server disk | EBS snapshot (EC2 Lifecycle Manager) | Har hafte | AWS | 4 snapshots | Recommend kiya; confirm karna hai |
| Live data (replica set) | EBS snapshot, dono data volumes (Data Lifecycle Manager, tag `backup=mongo`) | Roz | AWS | 3 din | Setup karna hai (MongoDB Replica Set SRS, Step 13) |
| Temporary ingest MongoDB | `mongodump --archive --gzip` | Roz 03:00 (cron, proposal) | Ingest server `~/backups`, phir S3 | 30 din | Command likha hai; cron confirm karna hai |
| Models, datasets, run reports | Copy | Har retrain | Abhi workstation; target S3 registry | Hamesha | Abhi manual |

**Backup check (har hafte):**
```bash
aws s3 ls s3://<bucket>/review-db/ | tail -3
```
Sabse nayi file 24 ghante se purani na ho.

---

## 6. Restore Procedures

### R-01: `review.db` Restore
```bash
aws s3 ls s3://<bucket>/review-db/ | tail -5
aws s3 cp s3://<bucket>/review-db/review_<stamp>.db /tmp/review.db
sqlite3 /tmp/review.db "PRAGMA integrity_check;"
sudo systemctl stop fraud-panel
sudo cp -a /opt/fraud-panel/data/review.db /opt/fraud-panel/data/review.db.before_restore
sudo install -o panel -g panel -m 640 /tmp/review.db /opt/fraud-panel/data/review.db
sudo systemctl start fraud-panel
```
- `integrity_check` ka jawab `ok` hona chahiye.
- Backup ke baad ke decisions kho jayenge (max 24 ghante). Reviewers ko batao ki us time ke decisions dobara dekhein; `decision_log` se list nikaali ja sakti hai.

### R-02: `users.db` Kho Jaye
- Backup ho to R-01 jaisa restore.
- Backup na ho to accounts dobara banao (P-02). Saare sessions khatam honge; reviewers ko naye passwords alag se, secure tareeke se diye jayenge.

### R-03: Panel Server Poora Kho Jaye
1. Naya EC2 (same size), same security group.
2. P-01 (setup) chalao.
3. R-01 se `review.db` lagao; `users.db` R-02 se.
4. P-03 se latest data bhejo (ya workstation pe `build_data.py` pehle chalao).
5. Front proxy / DNS ko naye server pe point karo.
6. P-05 se check karo; ek reviewer se sign-in aur ek purana decision dikhne ki pushti karwao.

### R-04: Temporary Ingest MongoDB Restore
```bash
docker compose exec -T mongo mongorestore -u <user> -p <password> --authenticationDatabase admin --archive --gzip --drop < <backup file>
```
Password command history me na rahe, iska dhyan rakho (jaise prompt se dena). Backup ke baad ka data platform se dobara bhejne ki request karo.

### R-05: Workstation Kho Jaye
- Code repository se wapas.
- Exports MongoDB se dobara nikalo.
- P-04 poora chalao.

Isiliye target me models aur datasets S3 registry me rakhe jayenge.

### R-06: Replica Set ke Dono Data Servers Kho Jayein
Ek server gire to restore nahi karna; woh wapas aake khud sync hota hai (M-02). Ye sirf tab jab `mongo-1` aur `mongo-2` dono gaye hon.

1. Sabse naye EBS snapshot se do naye 200 GB volumes banao (Singapore me).
2. Naye instances same naam, same security group aur same spec se launch karo (MongoDB Replica Set SRS, Step 4), aur Elastic IPs dobara jodo. DNS ke naam wahi rahenge, isliye replica set ki config bina badlav ke chal jaati hai.
3. Snapshot wale volumes `/data` pe mount karo, `mongod` chalu karo, M-01 se check karo.
4. Platform ko batao ki snapshot ke baad ka data (24 ghante tak) dobara likhe. Fixed `_id` ki wajah se duplicate nahi banenge.
5. Arbiter theek ho to kuch nahi; gaya ho to `rs.addArb()` se naya jodo.

---

## 7. DR Targets aur Scenarios

| Target | Value |
|---|---|
| RPO (kitna data kho sakte hain) | 24 ghante (`review.db`) |
| RTO (kitni der me wapas) | 4 ghante (panel) |

| Scenario | Asar | Recovery | Time |
|---|---|---|---|
| Panel service crash | Panel band | systemd 3 sec me restart; na ho to P-05, P-06 | Minutes |
| Galat update | Panel galat ya band | P-07 rollback | 15 minute |
| `review.db` kharab | Decisions nahi dikhte | R-01 | 1 ghanta |
| Panel server kho gaya | Panel band | R-03 | 4 ghante |
| Ingest server band | Naya data nahi aata; panel chalta rehta hai | I-02, I-03; platform se dobara bhejne ki request | 4 ghante |
| Replica set ka ek server gira | Kuch nahi; primary gira to 10–12 second ka failover | M-02; server theek karo, khud sync | Minutes |
| Replica set ke dono data servers gaye | Live data band; platform likh nahi pata | R-06 | 4 ghante |
| AWS region problem (Mumbai ya Singapore) | Us region ka sab band | Naye region me R-03 + R-04 / R-06 (snapshot ya S3 backup cross-region copy ho to) | 1 business day |

---

## 8. Restore Test (har mahine)

1. Ek alag test folder ya chhota test instance pe latest `review.db` backup restore karo (R-01, live service ko chhue bina).
2. `PRAGMA integrity_check` = `ok`.
3. `decisions` aur `decision_log` ke counts live database se milao (backup ke time tak).
4. Panel locally us copy ke saath chalao aur ek decision kholo.
5. Nateeja, date aur time yahan likho.

| Date | Kisne | Backup file | Nateeja | Time laga |
|---|---|---|---|---|
| | | | | |

---

## 9. Certificate aur Domain

| Item | Detail |
|---|---|
| Domain | `review-panel.api.savage1.one` |
| HTTPS | Front proxy / CDN deta hai; isliye server pe certbot nahi chala |
| Agar proxy hata | `setup_server.sh` email ke saath dobara chalao; certbot certificate lega aur khud renew karega |
| DNS ka owner | Sign-off pe likhna hai |

---

## 10. Open Actions

| # | Action | Owner |
|---|---|---|
| 1 | `users.db` ko bhi roz ke backup me jodna | MiraiGate admin |
| 2 | Live pe S3 backup aur IAM role chal rahe hain, ye confirm karna | MiraiGate admin |
| 3 | EBS weekly snapshots chalu karna | MiraiGate admin |
| 4 | MongoDB ka roz backup cron aur S3 copy | MiraiGate admin |
| 5 | Ingest API pe HTTPS | MiraiGate admin |
| 6 | Pehla restore test | MiraiGate admin |
| 7 | Replica set ke roz ke EBS snapshots (Lifecycle Manager) chalu karna | MiraiGate admin |
| 8 | Replica set ka pehla failover test (`rs.stepDown()`) aur R-06 ka ek test | MiraiGate admin |

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
| 1.1 | 14 Oct 2026 | Live data ka MongoDB replica set: Section 4A (M-01 se M-04), backup row (EBS snapshot 3 din), R-06, DR scenarios, open actions 7–8 |
