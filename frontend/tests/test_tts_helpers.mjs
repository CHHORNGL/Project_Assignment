import test from 'node:test';
import assert from 'node:assert/strict';

test('resolveTtsLanguage matches Khmer and English scripts regardless of UI locale', async () => {
  const { resolveTtsLanguage, sanitizeTtsText } = await import('../src/lib/ttsHelpers.ts');

  assert.equal(resolveTtsLanguage('សួស្តី កសិករ! ជំងឺរលាកស្លឹក', 'en'), 'km');
  assert.equal(resolveTtsLanguage('Hello rice blast disease management', 'km'), 'en');
  assert.equal(
    sanitizeTtsText('### **Treatment:** Use [Trichoderma](https://example.com) and `-` bio-control'),
    'Treatment: Use Trichoderma and - bio-control',
  );
});
