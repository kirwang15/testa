import { notFound } from "next/navigation";
import { CourseDetailPage } from "@/components/CourseDetailPage";
import { getAllCurricula, getCurriculumById } from "@/lib/curriculum-index";

export function generateStaticParams() {
  return getAllCurricula()
    .filter((course) => course.id !== "nce-1997")
    .map((course) => ({ curriculumId: course.id }));
}

export default async function CoursePage({
  params
}: {
  params: Promise<{ curriculumId: string }>;
}) {
  const { curriculumId } = await params;
  if (!getCurriculumById(curriculumId) || curriculumId === "nce-1997") notFound();
  return <CourseDetailPage curriculumId={curriculumId} />;
}
