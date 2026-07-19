import { LevelGame } from "@/components/LevelGame";
import {
  curriculumContentVersion,
  getAllLevels,
  isLegacyLevelRoute,
  levelExists
} from "@/lib/curriculum-index";
import { notFound } from "next/navigation";
import type { LevelRoutePayload } from "@/types/game";

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

  if (!levelExists(levelId) && !isLegacyLevelRoute(levelId)) {
    notFound();
  }

  const payload = {
    levelId,
    contentVersion: curriculumContentVersion
  } satisfies LevelRoutePayload;

  return <LevelGame key={levelId} {...payload} />;
}
