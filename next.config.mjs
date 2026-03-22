/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/register-school",
        destination: "/register?type=school",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
