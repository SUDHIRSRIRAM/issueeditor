import { HowItWorks as HowItWorksSection } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

const HowItWorks = () => {
  return (
    <div className="min-h-screen">
      <div className="py-20 px-4 hero-gradient">
        <h1 className="text-4xl md:text-6xl font-bold text-center text-gray-900 mb-6">
          How It <span className="text-primary">Works</span>
        </h1>
      </div>
      <HowItWorksSection />
      <Footer />
    </div>
  );
};

export default HowItWorks;