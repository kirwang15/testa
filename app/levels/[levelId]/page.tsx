import { LevelGame } from "@/components/LevelGame";
import { getAllLevels, getLevelById } from "@/lib/levelLoader";
import { notFound } from "next/navigation";

type LevelPageProps = {
  params: Promise<{
    levelId: string;
  }>;
};

export function generateStaticParams() {
  return getAllLevels().map((level) => ({
    levelId: level.id
  }));
}

export default async function LevelPage({ params }: LevelPageProps) {
  const { levelId } = await params;
  const level = getLevelById(levelId);

  if (!level) {
    notFound();
  }

  return <LevelGame level={level} />;
}
