import { initPlasmicLoader } from "@plasmicapp/loader-nextjs";
import { registerProfileLayoutComponents } from "@/plasmic-register";

export const PLASMIC = initPlasmicLoader({
  projects: [
    {
      id: "n1k5eb28ibApfGK5FDs4oD",
      token: "my4LDjNFU04SXTuMzIU7A00ANqurBmu2EjMMCzm1nTHttcJjfwdkpoRsjJtJ7rJkTt3ezI6WvzvbiM5rPqxvw",
    },
  ],
  preview: true,
});

registerProfileLayoutComponents(PLASMIC);
