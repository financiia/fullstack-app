'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { testGPT, testWaha } from './actions';

export default function TestPromptPage() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');

  const handleTest = async () => {
    const response = await testGPT(prompt);
    await testWaha(response);
    setResult(response);
  };
  return (
    <div className="">
      <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <Button onClick={handleTest}>Test</Button>
      <div>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </div>
    </div>
  );
}
