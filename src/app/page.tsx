import getSheetData from "@/services/sheets";
import { MainContent } from "@/components/MainContent";

export default async function Home() {
  const { presidents, indicators } = await getSheetData();

  return <MainContent presidents={presidents} indicators={indicators} />;
}
