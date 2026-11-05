# منصة حوكمة جودة أعمال الإنشاءات وإجراء 155 (Procedure 155 QCMS)

مشروع منصة حوكمة جودة أعمال الإنشاءات وإجراء 155 - إدارة كهرباء الحدود الشمالية.

## التشغيل في VS Code (Local Setup)

### 1. تثبيت الحزم (Install Dependencies)
افتح الطرفية (Terminal) في مجلد المشروع في VS Code ونفّذ:
```bash
npm install
```

### 2. تشغيل خادم التطوير (Run Development Server)
```bash
npm run dev
```
سيتم تشغيل الخادم على الرابط:
`http://localhost:3000`

### 3. بناء نسخة الإنتاج (Production Build)
```bash
npm run build
```

### 4. تشغيل نسخة الإنتاج (Production Start)
```bash
npm start
```

## هيكل المشروع (Project Structure)
- `src/` : كود الواجهة الأمامية React + TypeScript + Tailwind CSS.
  - `src/components/` : مكونات المنصة وجداول أوامر العمل ومؤشرات الأداء والدليل الإرشادي.
  - `src/data/` : البيانات المرجعية وقوائم الفحص الـ 18 المعتمدة (`auditChecklistData.ts`).
  - `src/services/` : خدمات التزامن الفوري، والتصدير، والتنبيهات.
  - `src/utils/` : محركات الحوكمة والأمان السحابي والدمك.
- `server.ts` : خادم Node.js / Express مع WebSocket ومحرك التزامن السحابي الحقيقي.
- `public/` : الملفات الثابتة والنسخ الاحتياطية المعتمدة (`backup_qcms_155_latest.json`).
- `backups/` : ملفات النسخ الاحتياطية الشاملة وقواعد البيانات.
