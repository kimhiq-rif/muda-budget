# מודע - PWA למעקב הוצאות

אפליקציית Web בעברית שאפשר להוסיף למסך הבית באייפון דרך Safari.

## מה כלול

- ווידג׳ט פנימי עם כפתורי הכנסה/הוצאה.
- מחשבון מהיר.
- מטבעות: שקל, באט תאילנדי, דולר אמריקאי, יורו.
- יעד חצי-חודשי ומשפטי מודעות.
- רשימת פעולות שנשמרת מקומית בדפדפן.
- מסך Gmail אמיתי דרך Google Identity Services ו-Gmail API.
- סריקת מיילים מהחודש הנוכחי לפי כתובות שולחים.
- אישור/דחייה לפני הוספת הוצאה לתקציב.

## התקנה באייפון

1. העלה את הקבצים ל-GitHub Pages.
2. פתח באייפון דרך Safari את כתובת GitHub Pages.
3. לחץ Share.
4. בחר Add to Home Screen.
5. פתח את "מודע" מהאייקון החדש.

## אם האייפון מציג גרסה ישנה

פתח ב-Safari:

`https://kimhiq-rif.github.io/muda-budget/reset.html?v=4`

אחרי שהדף אומר שהניקוי הושלם, לחץ "פתח את מודע מחדש" והוסף שוב למסך הבית.

## הפעלת Gmail אמיתי

1. פתח Google Cloud Console.
2. צור Project חדש.
3. הפעל Gmail API.
4. עבור ל-OAuth consent screen.
5. הגדר App name: מודע.
6. User type: External.
7. הוסף את עצמך כ-Test user.
8. הוסף Scope:
   `https://www.googleapis.com/auth/gmail.readonly`
9. עבור ל-Credentials.
10. צור OAuth Client ID מסוג Web application.
11. תחת Authorized JavaScript origins הוסף:
   `https://kimhiq-rif.github.io`
12. העתק את ה-Client ID.
13. באפליקציה, בלשונית Gmail, הדבק את ה-Client ID.
14. הזן כתובות מייל של קבלות, כל כתובת בשורה נפרדת.
15. לחץ "חבר", אשר הרשאת Gmail, ואז לחץ "סרוק חודש".

לשימוש אישי אפשר לעבוד במצב Testing עם המשתמש שלך כ-Test user. להפצה למשתמשים נוספים צריך אימות OAuth של Google ומדיניות פרטיות.
