import { redirect } from 'next/navigation'
export default function SurveyRedirect() {
    redirect('/admin/outreach?tab=results')
}
