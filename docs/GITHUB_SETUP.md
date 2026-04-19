# Gabay: GitHub mula sa simula (Windows)

Para ma-**push** ang Inventory System project mo sa GitHub. Sundan ang order.

---

## 1. Gumawa ng GitHub account (kung wala pa)

1. Buksan [https://github.com/signup](https://github.com/signup).  
2. Email, password, username — tapusin ang verification.  
3. I-verify ang email na ipinadala sa inbox mo.

---

## 2. Siguraduhing naka-install ang Git sa PC

Sa **PowerShell**:

```powershell
git --version
```

Kung may lumabas na version (hal. `git version 2.x`), okay na.  
Kung “not recognized”, i-download ang **Git for Windows**: [https://git-scm.com/download/win](https://git-scm.com/download/win) — default options ay okay para sa simula.

---

## 3. I-set ang pangalan at email sa Git (isang beses)

Dapat **tugma** sa email na ginamit mo sa GitHub (para makita ang commits mo nang tama):

```powershell
git config --global user.name "Buong Pangalan Mo"
git config --global user.email "email@ginamitmo.sa.github.com"
```

Tingnan:

```powershell
git config --global --list
```

---

## 4. Gumawa ng **bagong repository** sa GitHub (walang laman sa website)

1. Mag-login sa [https://github.com](https://github.com).  
2. **+** (taas-kanan) → **New repository**.  
3. **Repository name:** hal. `Inventory-System`  
4. **Public** o **Private** — pumili ka.  
5. **HUWAG** i-check ang:
   - Add a README file  
   - Add .gitignore  
   - Choose a license  

   *(Mayroon ka nang files sa laptop; mas simple kung empty ang repo sa GitHub.)*

6. I-click **Create repository**.  
7. Makikita mo ang page na may HTTPS URL, hal:

   `https://github.com/USERNAME/Inventory-System.git`

   **Kopyahin mo** ang URL na iyon — kailangan sa Hakbang 6.

---

## 5. Unang commit sa laptop (sa project folder)

```powershell
cd c:\Users\romme\CascadeProjects\Inventory-System
git add .
git commit -m "chore: initial commit — inventory system and documentation"
git branch -M main
```

Kung may error na “nothing to commit” — posibleng na-commit mo na dati; okay lang. Kung **“tell me who you are”** — balikan ang Hakbang 3.

---

## 6. Ikonekta ang GitHub at i-push (HTTPS + token)

### 6.1 Idagdag ang `remote`

Palitan ang URL ng **iyo**:

```powershell
git remote add origin https://github.com/Miming02/Inventory-System.git
```

Kung nagkamali ka ng URL:

```powershell
git remote remove origin
git remote add origin https://github.com/TAMANG-USERNAME/TAMANG-REPO.git
```

Tingnan:

```powershell
git remote -v
```

### 6.2 Personal Access Token (PAT) — password ng Git para sa HTTPS

GitHub **hindi** na tinatanggap ang account password mo sa `git push` gamit HTTPS. Kailangan ng **token**.

1. GitHub (browser) → **Settings** (profile icon) → sa kaliwa: **Developer settings** → **Personal access tokens**.  
2. **Fine-grained** o **Classic**:
   - **Classic (mas simple):** **Generate new token (classic)** → pangalan hal. `laptop-inventory` → check **repo** (sapat na para push/pull sa sarili mong repo) → **Generate** → **kopyahin agad** ang token (isang beses lang ipapakita).

### 6.3 I-push

```powershell
git push -u origin main
```

- Username: **GitHub username** mo  
- Password: **ang token** (hindi ang login password ng GitHub)

Sa Windows, maaaring i-save ng **Git Credential Manager** ang credentials para hindi mo na i-type palagi.

---

## 7. (Opsiyonal) Mas madali kung ayaw mo ng token sa terminal: **GitHub Desktop**

1. [https://desktop.github.com](https://desktop.github.com) — i-install.  
2. Sign in sa GitHub account.  
3. **File → Add local repository** → piliin ang `Inventory-System` folder.  
4. **Publish repository** — pipiliin ang account at repo name.

---

## 8. Pagkatapos ma-push

- Buksan ang repo sa browser: `https://github.com/USERNAME/Inventory-System` — dapat makita ang `frontend/`, `docs/`, atbp.  
- Susunod na pagbabago: `git add .` → `git commit -m "..."` → `git push`.

---

## 9. GitHub Actions (CI) — paano makita kung “green”

Ang repo may workflow: `.github/workflows/frontend-ci.yml` (nag-`npm ci`, `npm run lint`, `npm run build` sa `frontend/`).

1. **I-push** muna ang commits mo (`git push`).  
2. Sa GitHub, buksan ang repo → tab na **Actions**.  
3. Piliin ang pinakabagong run ng **Frontend CI**.  
4. **Green check** = pass; **pulang X** = buksan ang job → basahin ang log (hal. lint error).

*Note:* Una mong push na may workflow file ang magpapakita ng Actions; kung walang workflow noon, walang tab na ganoon.*

---

## Problema na madalas

| Sintomas | Gawin |
|----------|--------|
| `remote origin already exists` | `git remote remove origin` tapos `git remote add origin ...` ulit |
| `failed to push` / authentication | Gumawa ulit ng PAT; tiyaking may scope na **repo** |
| `src refspec main does not match any` | **(1)** Typo: dapat `git branch -M main` (hindi `mainx`). **(2)** Kung maling pangalan ng branch: `git branch` — i-push ang tamang pangalan, hal. `git push -u origin mainx`, *o* gumawa ng `main`: `git checkout -b main` tapos `git push -u origin main`. **(3)** Kung walang commit pa: `git add .` → `git commit -m "..."` muna. |

---

*Kung may error message ka, kopyahin ang buong text (walang token/password) at hanapin ang solusyon o itanong sa mentor.*
