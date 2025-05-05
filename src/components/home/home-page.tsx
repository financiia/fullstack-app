'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useUserInfo } from '@/hooks/useUserInfo';
import '../../styles/home-page.css';
import { LocalizationBanner } from '@/components/home/header/localization-banner';
import Header from '@/components/home/header/header';
import { HeroSection } from '@/components/home/hero-section/hero-section';
import { Pricing } from '@/components/home/pricing/pricing';
import { HomePageBackground } from '@/components/gradients/home-page-background';
import { Footer } from '@/components/home/footer/footer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

export function HomePage() {
  const supabase = createClient();
  const { user } = useUserInfo(supabase);
  const [country, setCountry] = useState('US');

  return (
    <>
      {/* <LocalizationBanner country={country} onCountryChange={setCountry} /> */}
      <div>
        <UpdateUserPhoneModal user={user} />
        <HomePageBackground />
        <Header user={user} />
        <HeroSection />
        <Pricing country={country} />
        <Footer />
      </div>
    </>
  );
}

function UpdateUserPhoneModal({ user }: { user: User | null }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log(user?.phone);
    if (!user) return;
    if (!user.phone) {
      setIsPhoneModalOpen(true);
    }
  }, [user?.phone]);

  const handleSavePhoneNumber = async () => {
    setIsLoading(true);
    // Here you would typically make an API call to save the phone number
    // For now, we'll just simulate a successful save
    await fetch('/api/update-user-phone', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneNumber, user_id: user?.id }),
    });

    setIsPhoneModalOpen(false);
    setIsSuccessModalOpen(true);
    setIsLoading(false);
  };

  return (
    <>
      <Dialog open={isPhoneModalOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Enter Your Phone Number</DialogTitle>
            <DialogDescription>Please enter your phone number to receive messages from our AI Bot.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Input
                type="tel"
                placeholder="+55 (DDD) 99999-9999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSavePhoneNumber} disabled={!phoneNumber || isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Phone Number'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessModalOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>
              Your phone number has been saved successfully.
              <br />
              The AI Bot has sent a message to your WhatsApp!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsSuccessModalOpen(false)}>Got it!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
