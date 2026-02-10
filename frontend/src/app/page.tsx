// 'use client'

// import { useEffect, useState } from 'react'
// import { useRouter } from 'next/navigation'

// interface Exam {
//   id: number
//   title: string
//   description: string
//   duration_minutes: number
//   total_questions: number
//   question_count: number
//   created_at: string
//   is_active: boolean
// }

// const API_BASE_URL = 'http://localhost:8000/api'

// export default function Home() {
//   const [exams, setExams] = useState<Exam[]>([])
//   const [loading, setLoading] = useState(true)
//   const router = useRouter()

//   useEffect(() => {
//     fetchExams()
//   }, [])

//   const fetchExams = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/exams/`)
//       if (response.ok) {
//         const data = await response.json()
//         setExams(data.results || data)
//       }
//     } catch (error) {
//       console.error('Error fetching exams:', error)
//     } finally {
//       setLoading(false)
//     }
//   }

//   const startExam = (examId: number) => {
//     router.push(`/test/${examId}`)
//   }

//   if (loading) {
//     return (
//       <div style={{ padding: '2rem', textAlign: 'center' }}>
//         <p>Loading exams...</p>
//       </div>
//     )
//   }

//   return (
//     <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
//       <header style={{ marginBottom: '2rem' }}>
//         <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>AI Exam Engine</h1>
//         <p style={{ color: '#666', fontSize: '1.1rem' }}>
//           Select an exam to begin
//         </p>
//       </header>

//       {exams.length === 0 ? (
//         <div style={{ 
//           padding: '3rem', 
//           textAlign: 'center', 
//           backgroundColor: '#f5f5f5', 
//           borderRadius: '8px',
//           border: '1px solid #ddd'
//         }}>
//           <p style={{ fontSize: '1.2rem', color: '#666' }}>
//             No exams available. Please create an exam in the admin panel.
//           </p>
//         </div>
//       ) : (
//         <div style={{ 
//           display: 'grid', 
//           gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
//           gap: '1.5rem'
//         }}>
//           {exams.map((exam) => (
//             <div
//               key={exam.id}
//               style={{
//                 border: '1px solid #ddd',
//                 borderRadius: '8px',
//                 padding: '1.5rem',
//                 backgroundColor: '#fff',
//                 boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
//                 transition: 'transform 0.2s, box-shadow 0.2s',
//                 cursor: 'pointer',
//               }}
//               onMouseEnter={(e) => {
//                 e.currentTarget.style.transform = 'translateY(-2px)'
//                 e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
//               }}
//               onMouseLeave={(e) => {
//                 e.currentTarget.style.transform = 'translateY(0)'
//                 e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
//               }}
//               onClick={() => startExam(exam.id)}
//             >
//               <h2 style={{ 
//                 fontSize: '1.5rem', 
//                 marginBottom: '0.5rem',
//                 color: '#333'
//               }}>
//                 {exam.title}
//               </h2>
//               {exam.description && (
//                 <p style={{ 
//                   color: '#666', 
//                   marginBottom: '1rem',
//                   fontSize: '0.95rem'
//                 }}>
//                   {exam.description}
//                 </p>
//               )}
//               <div style={{ 
//                 display: 'flex', 
//                 justifyContent: 'space-between',
//                 marginTop: '1rem',
//                 paddingTop: '1rem',
//                 borderTop: '1px solid #eee',
//                 fontSize: '0.9rem',
//                 color: '#888'
//               }}>
//                 <span>⏱️ {exam.duration_minutes} min</span>
//                 <span>❓ {exam.question_count || exam.total_questions} questions</span>
//               </div>
//               <button
//                 style={{
//                   width: '100%',
//                   marginTop: '1rem',
//                   padding: '0.75rem',
//                   backgroundColor: '#0070f3',
//                   color: 'white',
//                   border: 'none',
//                   borderRadius: '6px',
//                   fontSize: '1rem',
//                   fontWeight: '600',
//                   cursor: 'pointer',
//                   transition: 'background-color 0.2s'
//                 }}
//                 onMouseEnter={(e) => {
//                   e.currentTarget.style.backgroundColor = '#0051cc'
//                 }}
//                 onMouseLeave={(e) => {
//                   e.currentTarget.style.backgroundColor = '#0070f3'
//                 }}
//               >
//                 Start Exam
//               </button>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }


"use client"

import { ExamHome } from "@/components/exam-home"

export default function HomePage() {
  return <ExamHome />
}