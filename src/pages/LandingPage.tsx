import { useEffect, useRef } from "react";
import { SUPPORT_EMAIL, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, USER_DATA_DELETION_URL } from "../config/brand";
import { SEOHead } from "../seo/SEOHead";
import content from "./landing/content.html?raw";
import { createLandingLifetime } from "./landing/lifetime";
import { initPresentation } from "./landing/presentation.js";
import { initMotion } from "./landing/motion.js";
import "./landing/landing.css";
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
  title: "iGen — Đồng hành cùng cửa hàng điện thoại",
  description: "iGen kết nối hành trình bán hàng, chăm sóc khách hàng và bảo hành dành cho cửa hàng điện thoại, phụ kiện và sửa chữa.",
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
    const section = container.querySelector<HTMLElement>(".phone-story")!;
    const loadPhone = async () => {
      try {
        const { initPhoneStory } = await import("./landing/phone.js");
        if (!life.disposed) initPhoneStory(section, life);
      } catch {
        if (life.disposed) return;
        section.dataset.renderer = "fallback";
        section.classList.add("spin-static");
        section.querySelectorAll<HTMLButtonElement>("button").forEach(button => { button.disabled = true; });
        section.querySelector(".phone-spin-caption")!.textContent = "Không thể tải mô hình 3D. Bạn vẫn có thể khám phá iGen bên dưới.";
      }
    };
    // Fetch the large 3D module only when approaching its section.
    const observer = life.observe(new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void loadPhone();
    }, { rootMargin: "600px" }));
    observer.observe(section);
    const hash = window.location.hash.slice(1);
    if (hash) container.querySelector<HTMLElement>(`#${CSS.escape(hash)}`)?.scrollIntoView();
    return () => life.dispose();
  }, []);

  return <>
    <SEOHead meta={meta} />
    <div ref={host} className="igen-landing" data-concept="clarity" dangerouslySetInnerHTML={{ __html: markup }} />
  </>;
}
