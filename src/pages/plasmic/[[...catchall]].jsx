import {
  PlasmicRootProvider,
  PlasmicComponent,
  extractPlasmicQueryData,
} from "@plasmicapp/loader-nextjs";
import Error from "next/error";
import { useRouter } from "next/router";
import { PLASMIC } from "../../plasmic-loader";

export async function getStaticPaths() {
  const pages = await PLASMIC.fetchPages();

  return {
    paths: pages.map((page) => ({
      params: {
        catchall: page.path.substring(1).split("/"),
      },
    })),
    fallback: "blocking",
  };
}

export async function getStaticProps(context) {
  const { catchall } = context.params ?? {};

  const plasmicPath = Array.isArray(catchall)
    ? `/${catchall.join("/")}`
    : "/";

  const plasmicData = await PLASMIC.maybeFetchComponentData(plasmicPath);

  if (!plasmicData) {
    return {
      props: {},
    };
  }

  const pageMeta = plasmicData.entryCompMetas[0];

  const queryCache = await extractPlasmicQueryData(
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      pageRoute={pageMeta.path}
      pageParams={pageMeta.params}
    >
      <PlasmicComponent component={pageMeta.displayName} />
    </PlasmicRootProvider>
  );

  return {
    props: {
      plasmicData,
      queryCache,
    },
    revalidate: 60,
  };
}

export default function PlasmicPage({ plasmicData, queryCache }) {
  const router = useRouter();

  if (!plasmicData || plasmicData.entryCompMetas.length === 0) {
    return <Error statusCode={404} />;
  }

  const pageMeta = plasmicData.entryCompMetas[0];

  return (
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      prefetchedQueryData={queryCache}
      pageRoute={pageMeta.path}
      pageParams={pageMeta.params}
      pageQuery={router.query}
    >
      <PlasmicComponent component={pageMeta.displayName} />
    </PlasmicRootProvider>
  );
}