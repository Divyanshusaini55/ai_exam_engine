# Frontend Codebase Analysis Report
## Unused Files, Dead Code, and Missing Integrations

---

## 🔴 **CRITICAL: Unused Components (Never Imported)**

### 1. `src/components/navbar.tsx`
- **Type:** Component
- **Status:** ❌ **UNUSED - DELETE**
- **Why:** Exported but never imported in any page or layout
- **Intended Use:** Was meant for navigation, but `exam-home.tsx` has its own header built-in
- **Action:** Delete file

### 2. `src/components/exam-grid.tsx`  
- **Type:** Component  
- **Status:** ❌ **UNUSED - DELETE**
- **Why:** Exported `ExamGrid` component but never imported anywhere
- **Intended Use:** Probably meant to replace inline exam listing in category pages, but never integrated
- **Action:** Delete file (or integrate into `category/[categoryId]/page.tsx`)

---

## 🟡 **DEAD CODE: Commented Out / Inactive**

### 3. `src/components/QuestionCard.tsx`
- **Type:** Component
- **Status:** 🟡 **DEAD CODE - Most content commented out**
- **Why:** Entire file is commented out (lines 1-162), but still imported in `/test/[id]/page.tsx`
- **Current State:** Empty/export default with no implementation
- **Action:** 
  - If keeping `/test/[id]` route: Restore implementation
  - If removing old test route: Delete this file

### 4. `src/app/page.tsx`
- **Type:** Page (Root route)
- **Status:** 🟡 **PARTIALLY DEAD CODE**
- **Why:** Lines 1-160 are commented out (old implementation)
- **Current State:** Only uses `ExamHome` component (lines 163-169)
- **Action:** Remove commented code (lines 1-160)

---

## 🟠 **UNREACHABLE ROUTES (Not Linked from Anywhere)**

### 5. `src/app/test/[id]/page.tsx`
- **Type:** Page Route (`/test/[id]`)
- **Status:** 🟠 **UNREACHABLE - No navigation links to it**
- **Why:** 
  - All exam cards navigate to `/shift/[shiftId]` (new route)
  - Commented code in `page.tsx` had `router.push('/test/${examId}')` but it's commented
  - This appears to be an OLD/ALTERNATE test interface
- **Still Imports:** `Timer.tsx` and `QuestionCard.tsx` (both dead/commented)
- **Action:** 
  - **Option A:** Delete entire `/test` directory (recommended - duplicate functionality)
  - **Option B:** Keep if this is meant to be an alternate simple test interface

### 6. `src/app/test/[id]/results/page.tsx`
- **Type:** Page Route (`/test/[id]/results`)
- **Status:** 🟠 **UNREACHABLE - Only linked from old `/test/[id]` route**
- **Why:** Only navigation is from `/test/[id]/page.tsx` (which itself is unreachable)
- **Action:** Delete if removing `/test` route (recommended)

### 7. `src/app/exam/[examId]/page.tsx`
- **Type:** Page Route (`/exam/[examId]`)
- **Status:** 🟠 **UNREACHABLE - Never linked/accessed**
- **Why:** 
  - Created but no component/navigation ever uses this route
  - All navigation goes to `/shift/[shiftId]` instead
  - This was probably meant to show exam details before starting, but never integrated
- **Action:** 
  - **Option A:** Delete (if not needed)
  - **Option B:** Integrate - Add link from `ExamCard` or `CategoryPage` to show exam details before starting

### 8. `src/app/loading/[examId]/page.tsx`
- **Type:** Page Route (`/loading/[examId]`)
- **Status:** 🟠 **UNREACHABLE - Never navigated to**
- **Why:** 
  - Was probably meant as a loading state after exam submission
  - But `ExamTakingInterface` submits directly and navigates to `/dashboard/[examId]`
  - This loading page auto-redirects anyway, so it's redundant
- **Action:** Delete (loading state should be handled within component, not a separate route)

---

## 🟢 **POTENTIALLY UNUSED (Verify API Support)**

### 9. `src/lib/api.ts` - `explainQuestion` method
- **Type:** Utility (API method)
- **Status:** 🟢 **CHECK BACKEND - API endpoint may not exist**
- **Why:** 
  - Used in `question-review.tsx` (line 37)
  - But backend `api.py` doesn't have `/exams/explain_question/` endpoint
- **Action:** 
  - Verify if backend supports this endpoint
  - If not: Either implement backend endpoint OR remove "AI Explain" button from `QuestionReview`

---

## ✅ **ACTIVE & USED FILES (Keep)**

### Pages:
- ✅ `src/app/page.tsx` (uses ExamHome)
- ✅ `src/app/layout.tsx` (root layout)
- ✅ `src/app/category/[categoryId]/page.tsx` (used by CategoryGrid)
- ✅ `src/app/shift/[shiftId]/page.tsx` (main exam taking route)
- ✅ `src/app/dashboard/[examId]/page.tsx` (results dashboard)

### Components (All Used):
- ✅ `src/components/exam-home.tsx` (used by page.tsx)
- ✅ `src/components/category-grid.tsx` (used by exam-home.tsx)
- ✅ `src/components/exam-card.tsx` (used by category-page and exam-grid)
- ✅ `src/components/exam-taking-interface.tsx` (used by shift route)
- ✅ `src/components/performance-analysis.tsx` (used by dashboard route)
- ✅ `src/components/question-navigator.tsx` (used by exam-taking-interface)
- ✅ `src/components/question-review.tsx` (used by performance-analysis)
- ✅ `src/components/circular-progress.tsx` (used by performance-analysis)
- ✅ `src/components/stats-card.tsx` (used by performance-analysis)
- ✅ `src/components/submission-loading-state.tsx` (used by loading route - but route itself is unreachable)

### Utilities:
- ✅ `src/lib/api.ts` (used throughout, except `explainQuestion` method)

---

## 📊 **DEPENDENCY GRAPH**

```
Root (/)
  └─ ExamHome
      └─ CategoryGrid
          └─ [Navigate] → /category/[categoryId]
              └─ ExamCard (multiple)
                  └─ [Navigate] → /shift/[shiftId]
                      └─ ExamTakingInterface
                          ├─ QuestionNavigator
                          └─ [Submit] → /dashboard/[examId]
                              └─ PerformanceAnalysisDashboard
                                  ├─ CircularProgress
                                  ├─ StatsCard (multiple)
                                  └─ QuestionReview (multiple)
                                      └─ [Uses] examApi.explainQuestion ❓

UNUSED/UNREACHABLE:
  /test/[id] → Timer, QuestionCard (commented)
  /exam/[examId] → (no links)
  /loading/[examId] → SubmissionLoadingState (no links)
  navbar.tsx → (not imported)
  exam-grid.tsx → (not imported)
```

---

## ✅ **ACTIONABLE CHECKLIST**

### Immediate Actions (Recommended):

- [ ] **DELETE** `src/components/navbar.tsx` (unused component)
- [ ] **DELETE** `src/components/exam-grid.tsx` (unused component)
- [ ] **DELETE** `src/app/test/[id]/` directory (entire route unreachable, duplicate of `/shift`)
- [ ] **DELETE** `src/app/test/[id]/results/` directory (unreachable)
- [ ] **DELETE** `src/app/loading/[examId]/` directory (unreachable, redundant)
- [ ] **CLEAN** `src/app/page.tsx` - Remove commented code (lines 1-160)
- [ ] **DECIDE** on `src/app/exam/[examId]/page.tsx`:
  - [ ] **Option A:** Delete it (not linked anywhere)
  - [ ] **Option B:** Integrate - Add link from `ExamCard` to show exam details before starting
- [ ] **VERIFY** `src/lib/api.ts` - `explainQuestion` method:
  - [ ] Check if backend has `/exams/explain_question/` endpoint
  - [ ] If not: Either implement backend OR remove "AI Explain" feature from `QuestionReview`
- [ ] **CLEAN** `src/components/QuestionCard.tsx`:
  - [ ] If keeping `/test` route: Restore implementation
  - [ ] If deleting `/test` route: Delete this file too

### Optional Improvements:

- [ ] Consider adding `ExamGrid` to `category/[categoryId]/page.tsx` for search/filter functionality
- [ ] If keeping `/exam/[examId]`, add navigation links from exam cards
- [ ] Add loading states within components instead of separate routes

---

## 📝 **SUMMARY**

- **Total Unused Files:** 8 files/directories
- **Dead Code Blocks:** 2 files (mostly commented)
- **Unreachable Routes:** 4 routes
- **Unused Components:** 2 components
- **Potentially Broken API:** 1 method (`explainQuestion`)

**Recommended Deletions:** ~6 files/directories
**Recommended Cleanup:** 2 files (remove comments)
**Decision Needed:** 1 route (`/exam/[examId]` - keep or delete)

---

**Generated:** 2025-01-26
**Analysis Method:** Import/export tracking, route navigation mapping, grep-based reference search
