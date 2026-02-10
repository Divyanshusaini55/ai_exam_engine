#!/bin/bash

# Add useNoIndex() calls to component bodies

# forgot-password
perl -i -pe 's/^(export default function ForgotPasswordPage\(\) \{)$/\1\n    useNoIndex() \/\/ Prevent search engine indexing/' src/app/forgot-password/page.tsx

# reset-password
perl -i -pe 's/^(export default function ResetPasswordPage\(\) \{)$/\1\n    useNoIndex() \/\/ Prevent search engine indexing/' src/app/reset-password/page.tsx

# admin-messages
perl -i -pe 's/^(export default function AdminMessages\(\) \{)$/\1\n    useNoIndex() \/\/ Prevent search engine indexing/' src/app/admin-messages/page.tsx

# loading/[examId]
perl -i -pe 's/^(export default function ResultsLoadingPage\(\) \{)$/\1\n    useNoIndex() \/\/ Prevent search engine indexing/' src/app/loading/\[examId\]/page.tsx

# dashboard/[examId]
perl -i -pe 's/^(export default function ExamResultPage\(\) \{)$/\1\n    useNoIndex() \/\/ Prevent search engine indexing/' src/app/dashboard/\[examId\]/page.tsx

# shift/[shiftId]
perl -i -pe 's/^(export default function ShiftPage\(\) \{)$/\1\n    useNoIndex() \/\/ Prevent search engine indexing/' src/app/shift/\[shiftId\]/page.tsx

echo "Done adding useNoIndex() calls!"
