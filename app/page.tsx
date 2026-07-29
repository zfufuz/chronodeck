import type { Metadata } from "next";
import ChronoDeck from "./ChronoDeck";

export const metadata: Metadata = {
  title: "时序舱 · ChronoDeck",
  description: "看见时间，重组节奏。一个兼顾计划、容量与专注的个人时间操作系统。",
};

export default function Home() {
  return <ChronoDeck />;
}
