import { Hero } from "@/components/Hero";
import { Stats } from "@/components/Stats";
import { Features as FeaturesSection } from "@/components/Features";
import { Footer } from "@/components/Footer";

const Features = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <Stats />
      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Features;