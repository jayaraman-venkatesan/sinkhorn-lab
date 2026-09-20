import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { SceneRegistry } from './SceneRegistry';

const lessonModules = import.meta.glob<string>('../../../content/lessons/*.md', { eager: true, query: '?raw', import: 'default' });
const assetModules = {
  ...import.meta.glob<string>('../../../content/figures/*.svg', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob<string>('../../../content/examples/*.json', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob<string>('../../../docs/research/paper-arxiv-1306-0895-sinkhorn-shift-lab/*.md', { eager: true, query: '?url', import: 'default' }),
};
const assets = new Map(Object.entries(assetModules).map(([filename, url]) => [filename.match(/(?:content\/(?:figures|examples)|docs\/research\/paper-arxiv-1306-0895-sinkhorn-shift-lab)\/[^/]+$/)?.[0], url]));

export const chapters = [
  { slug: '01-problem', label: '1. Meet the problem' },
  { slug: '02-manual-allocation', label: '2. Try a plan' },
  { slug: '03-history', label: '3. Research history' },
  { slug: '04-regularization', label: '4. Scaling steps' },
  { slug: '05-numerical-behavior', label: '5. Numerical behavior' },
  { slug: '06-library-usage', label: '6. C# integration' },
] as const;

function lessonSource(slug: string): string | undefined {
  const entry = Object.entries(lessonModules).find(([filename]) => filename.endsWith(`/${slug}.md`));
  return entry?.[1];
}

export function safeLessonUrl(url: string): string {
  if (url.includes('\\') || url.startsWith('//')) return '';
  if (url.startsWith('../figures/') || url.startsWith('../examples/')) {
    const key = `content/${url.slice(3).split('#', 1)[0]}`;
    const asset = assets.get(key);
    return asset ? `${asset}${url.includes('#') ? `#${url.split('#')[1]}` : ''}` : '';
  }
  if (url.startsWith('../../docs/research/paper-arxiv-1306-0895-sinkhorn-shift-lab/')) {
    return assets.get(url.slice(6)) ?? '';
  }
  if (/^(?:\.\/)?[0-9]{2}-[a-z0-9-]+\.md(?:#[a-z0-9-]+)?$/.test(url)) {
    const [filename, fragment] = url.replace(/^\.\//, '').split('#');
    return `/lessons/${filename!.replace(/\.md$/, '')}${fragment ? `#${fragment}` : ''}`;
  }
  if (/^\/(?:lab|lessons\/[0-9]{2}-[a-z0-9-]+)(?:#[a-z0-9-]+)?$/.test(url) || url.startsWith('#')) return url;
  return defaultUrlTransform(url);
}

function sceneIds(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(\.\.\/examples\/([a-z0-9-]+)\.json(?:#([a-z0-9-]+))?\)/g)]
    .map((match) => match[2] ?? match[1]!);
}

export function CourseNavigation() {
  return <nav className="course-navigation" aria-label="Course chapters">
    <a className="course-brand" href="/">Sinkhorn course</a>
    <ol>{chapters.map((chapter) => <li key={chapter.slug}><a href={`/lessons/${chapter.slug}`}>{chapter.label}</a></li>)}</ol>
    <a className="lab-link" href="/lab">Open the experiment lab</a>
  </nav>;
}

export function LessonPage({ slug }: { slug: string }) {
  const markdown = lessonSource(slug);
  if (!markdown) return <><CourseNavigation /><article className="lesson"><h1>Chapter not found</h1><p>Choose a chapter from the course navigation.</p></article></>;
  return <>
    <CourseNavigation />
    <article className="lesson">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} skipHtml urlTransform={safeLessonUrl}>{markdown}</ReactMarkdown>
      <SceneRegistry ids={sceneIds(markdown)} />
      <nav className="lesson-end" aria-label="Continue learning"><a href="/lab">Open the experiment lab</a></nav>
    </article>
  </>;
}
