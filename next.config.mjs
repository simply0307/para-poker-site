/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://studio.plasmic.app https://*.plasmic.app http://localhost:3000 http://127.0.0.1:3000;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;