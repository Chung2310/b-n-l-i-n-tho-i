import { useEffect, useRef } from "react";
import { SUPPORT_EMAIL, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, USER_DATA_DELETION_URL } from "../config/brand";
import { SEOHead } from "../seo/SEOHead";
import content from "./landing/content.html?raw";
import { createLandingLifetime } from "./landing/lifetime";
import { initPresentation } from "./landing/presentation.js";
import { initMotion } from "./landing/motion.js";
import "./landing/landing.css";
import { initSalesCarousel } from "./landing/sales-carousel.js";
import { initInteractions } from "./landing/interactions.js";
import "./landing/interactions.css";

const escapeAttribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
// Local, trusted presentation template; never API or user-supplied HTML.
const markup = content
  .replaceAll("{{supportEmail}}", escapeAttribute(SUPPORT_EMAIL))
  .replaceAll("{{privacyUrl}}", escapeAttribute(PRIVACY_POLICY_URL))
  .replaceAll("{{termsUrl}}", escapeAttribute(TERMS_OF_SERVICE_URL))
  .replaceAll("{{deletionUrl}}", escapeAttribute(USER_DATA_DELETION_URL));
const meta = {
  title: "iGEN Retail — Nền tảng Quản trị Bán lẻ & Doanh nghiệp Toàn diện",
  description: "iGEN Retail kết nối hành trình bán hàng, quản lý kho, chăm sóc khách hàng và vận hành doanh nghiệp toàn diện dành cho các chuỗi bán lẻ và dịch vụ.",
  keywords: "igen, cửa hàng điện thoại, bán hàng điện thoại, chăm sóc khách hàng, bảo hành",
  path: "/",
};

export default function LandingPage() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current!;
    const life = createLandingLifetime();
    // Reset imperative presentation changes on StrictMode remounts.
    container.innerHTML = markup;
    initPresentation(container, life);
    initMotion(container, life);
    initInteractions(container, life);
    initSalesCarousel(container, life);
    const hash = window.location.hash.slice(1);
    if (hash) container.querySelector<HTMLElement>(`#${CSS.escape(hash)}`)?.scrollIntoView();
    return () => life.dispose();
  }, []);

  return <>
    <SEOHead meta={meta} />
    <div ref={host} className="igen-landing" data-concept="clarity" dangerouslySetInnerHTML={{ __html: markup }} />
  </>;
}
