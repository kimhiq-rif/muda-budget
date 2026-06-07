# מודע - קישורי עדכון וניקוי

גרסה נוכחית: **v9**  
מיתוג: **kimคcode**

## קישורים קבועים

האתר הרגיל:

```text
https://kimhiq-rif.github.io/muda-budget/
```

בדיקת הגרסה החדשה ישירות:

```text
https://kimhiq-rif.github.io/muda-budget/?v=9
```

ניקוי Service Worker ו-cache באייפון:

```text
https://kimhiq-rif.github.io/muda-budget/reset.html?v=9
```

קבצים ישירים לבדיקה:

```text
https://kimhiq-rif.github.io/muda-budget/index.html?v=9
https://kimhiq-rif.github.io/muda-budget/app.js?v=9
https://kimhiq-rif.github.io/muda-budget/styles.css?v=9
https://kimhiq-rif.github.io/muda-budget/service-worker.js?v=9
```

## אחרי העלאת גרסה חדשה

1. העלה את כל קבצי ה-ZIP לריפו.
2. עשה Commit.
3. חכה שה-Deployment יהיה ירוק.
4. באייפון פתח:

```text
https://kimhiq-rif.github.io/muda-budget/reset.html?v=9
```

5. לחץ "פתח את מודע מחדש".
6. הוסף שוב למסך הבית אם צריך.

## אם האייפון לא מתעדכן

נסה לפי הסדר:

1. סגור את מודע מה-App Switcher.
2. פתח Safari ופתח:

```text
https://kimhiq-rif.github.io/muda-budget/?v=9
```

3. אם עדיין ישן, פתח:

```text
https://kimhiq-rif.github.io/muda-budget/reset.html?v=9
```

4. אם עדיין ישן, מחק את האייקון של מודע ממסך הבית והוסף מחדש.
5. אם עדיין ישן, באייפון:
   Settings > Safari > Advanced > Website Data
   ואז מחק נתונים של `github.io` או `kimhiq-rif`.

## מה יש ב-v9

- סימון גרסה בתוך האפליקציה: `v9 · kimคcode`.
- מנוע Gmail שקט עם חיווי בזמן סריקה.
- חיווי סיום אחרי שהמנוע מסיים לעבוד.
- מניעת כפילויות.
- דוח חצי-חודשי.
- ארכיון תמונות חשבוניות.
- חיפוש חשבוניות לפי שם.

## הערת שמירת מידע

המידע נשמר מקומית באייפון. תמונות נשמרות ב-IndexedDB עד שנתיים, כל עוד לא מוחקים את נתוני האתר או את האפליקציה ממסך הבית.
