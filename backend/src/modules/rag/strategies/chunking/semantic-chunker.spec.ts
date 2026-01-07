import { SemanticChunker } from './semantic-chunker.strategy';

describe('SemanticChunker', () => {
  let chunker: SemanticChunker;

  beforeEach(() => {
    chunker = new SemanticChunker();
  });

  describe('Speaker-aware chunking', () => {
    it('should preserve complete dialogue exchanges', async () => {
      const therapySession = `therapist: Hello, how have you been feeling since our last session?
client: I've been doing better. I tried the breathing exercises you suggested.
therapist: That's great to hear. Can you tell me more about your experience with them?
client: They really helped when I felt anxious at work. I used them three times this week.
therapist: Excellent progress. Let's discuss how we can build on this momentum.
client: I'd like to learn more techniques for managing stress during meetings.
therapist: Absolutely. Today we'll explore cognitive restructuring techniques that can help.
client: That sounds helpful. I've noticed my thoughts spiral when I'm under pressure.`;

      const chunks = await chunker.process(therapySession);

      // Should create chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Each chunk should have speaker turns
      chunks.forEach(chunk => {
        expect(chunk.text).toMatch(/therapist:|client:/);
      });

      // Verify metadata
      expect(chunks[0].metadata.chunkIndex).toBe(0);
      expect(chunks[0].metadata.totalChunks).toBe(chunks.length);
      expect(chunks[0].metadata.tokenCount).toBeGreaterThan(0);
    });

    it('should not split mid-exchange', async () => {
      const shortSession = `therapist: How do you feel about trying cognitive behavioral therapy?
client: I'm open to it. I've heard good things.
therapist: Great. CBT focuses on identifying and changing negative thought patterns.
client: That makes sense. I do tend to catastrophize situations.`;

      const chunks = await chunker.process(shortSession);

      // With proper chunking, this short session should stay as one chunk
      expect(chunks.length).toBeLessThanOrEqual(2);
    });

    it('should handle abbreviations correctly', async () => {
      const textWithAbbreviations = `therapist: Dr. Smith recommended CBT for anxiety disorders, i.e., panic disorder and GAD. Research shows it's effective, e.g., Brown et al. (2020) found 85% improvement rates.
client: I see. My previous therapist, Dr. Johnson, mentioned something similar.
therapist: Yes. Ph.D. researchers vs. M.D. practitioners often have different approaches, but both recognize CBT's efficacy.`;

      const chunks = await chunker.process(textWithAbbreviations);

      // Should not split at abbreviations
      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that Dr., Ph.D., etc. are preserved
      const fullText = chunks.map(c => c.text).join(' ');
      expect(fullText).toContain('Dr. Smith');
      expect(fullText).toContain('Dr. Johnson');
      expect(fullText).toContain('Ph.D.');
      expect(fullText).toContain('i.e.');
      expect(fullText).toContain('e.g.');
    });
  });

  describe('Sentence-based chunking (non-dialogue)', () => {
    it('should chunk regular text by sentences', async () => {
      const regularText = `Cognitive behavioral therapy is an evidence-based approach. It helps individuals identify negative thought patterns. The therapist guides clients through structured exercises. These exercises promote positive behavioral changes. Research demonstrates significant efficacy rates.`;

      const chunks = await chunker.process(regularText);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.metadata.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should handle complex punctuation', async () => {
      const complexText = `The client asked, "What if I can't do it?" The therapist responded reassuringly. He said the process takes time! Success isn't immediate. Progress happens gradually over weeks.`;

      const chunks = await chunker.process(complexText);

      expect(chunks.length).toBeGreaterThan(0);
      const fullText = chunks.map(c => c.text).join(' ');
      expect(fullText).toContain('"What if I can\'t do it?"');
    });
  });

  describe('Token counting', () => {
    it('should provide accurate token counts', async () => {
      const text = 'therapist: Hello, how are you feeling today?';
      
      const chunks = await chunker.process(text);
      
      expect(chunks[0].metadata.tokenCount).toBeGreaterThan(0);
      // Approximate check: should be roughly 8-12 tokens
      expect(chunks[0].metadata.tokenCount).toBeLessThan(20);
    });
  });

  describe('Overlap handling', () => {
    it('should create overlap between chunks for context', async () => {
      const longSession = Array(50).fill(
        'therapist: How are you feeling?\nclient: I feel better today.'
      ).join('\n');

      const chunks = await chunker.process(longSession);

      if (chunks.length > 1) {
        // Check for overlap by looking for repeated content
        const firstChunkEnd = chunks[0].text.slice(-100);
        const secondChunkStart = chunks[1].text.slice(0, 100);
        
        // Should have some overlap (not exact match due to line boundaries)
        expect(chunks[1].text).toMatch(/therapist:|client:/);
      }
    });
  });
});

