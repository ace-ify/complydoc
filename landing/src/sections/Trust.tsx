import { FileLock2Icon, KeyRoundIcon, ScaleIcon, WifiOffIcon, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import type { Brand } from "@/lib/logos";

const FACTS: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: FileLock2Icon, title: "Runs on your machine", detail: "Documents and reports stay where you run it." },
  { icon: WifiOffIcon, title: "Network blocked", detail: "While documents are read, and the report records it." },
  { icon: KeyRoundIcon, title: "No account, no key", detail: "Install it and point it at a folder." },
  { icon: ScaleIcon, title: "MIT licensed", detail: "Open source, all of it." },
];

/** Loaders with a preset or a tested integration. Any loader with load(), load_data() or lazy_load() works. */
const LOADERS: { name: string; brand: Brand }[] = [
  { name: "LangChain", brand: "langchain" },
  { name: "LlamaIndex", brand: "llamaindex" },
  { name: "Docling", brand: "docling" },
  { name: "Unstructured", brand: "unstructured" },
  { name: "LlamaParse", brand: "llamaindex" },
  { name: "Azure Document Intelligence", brand: "azure" },
];

/** What a careful reader asks first, answered before they ask, and what it works with. */
export function Trust() {
  return (
    <section aria-label="What to know first" className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.title} className="flex flex-col gap-1">
              <dt className="flex items-center gap-2 font-medium">
                <fact.icon className="size-4 text-primary" />
                {fact.title}
              </dt>
              <dd className="text-sm text-muted-foreground">{fact.detail}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-8">
          <p className="shrink-0 text-sm text-muted-foreground">Works with</p>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-4 text-sm font-medium">
            {LOADERS.map((loader) => (
              <li key={loader.name} className="flex items-center gap-2">
                <BrandLogo brand={loader.brand} className="size-5" />
                {loader.name}
              </li>
            ))}
            <li className="text-muted-foreground">and any loader that returns documents</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
