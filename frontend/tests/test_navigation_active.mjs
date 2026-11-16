import test from 'node:test';
import assert from 'node:assert/strict';

test('isNavHrefActive matches exact, query-stripped, and nested routes including trailing slashes', async () => {
  const { isNavHrefActive } = await import('../src/lib/navigation.ts');

  assert.equal(isNavHrefActive('/admin/dashboard', '/admin/dashboard'), true);
  assert.equal(isNavHrefActive('/admin/crops/12/edit', '/admin/crops/'), true);
  assert.equal(isNavHrefActive('/admin/crops/', '/admin/crops/'), true);
  assert.equal(isNavHrefActive('/admin/roles/4/permissions?tab=matrix', '/admin/roles'), true);
  assert.equal(isNavHrefActive('/admin/users-archive', '/admin/users'), false);
  assert.equal(isNavHrefActive('/admin/dashboard', '/'), false);
});

test('buildNavSections preserves sections and marks active navigation items', async () => {
  const { buildNavSections } = await import('../src/lib/navigation.ts');

  const sections = buildNavSections({
    path: '/admin/crops/new',
    ui: {
      navigation: {
        sections: [
          {
            title: 'Overview',
            items: [{ label: 'Dashboard', href: '/admin/dashboard' }],
          },
          {
            title: 'Catalog & Content',
            items: [{ label: 'Crops', href: '/admin/crops/' }],
          },
        ],
      },
    },
  });

  assert.equal(sections.length, 2);
  assert.equal(sections[0].items[0].active, false);
  assert.equal(sections[1].items[0].active, true);
});

test('buildFarmerBottomNav returns 5 ordered tabs and highlights active Farmer routes', async () => {
  const { buildFarmerBottomNav } = await import('../src/lib/navigation.ts');

  const baseBootstrap = {
    lang: 'en',
    user: { id: 12 },
    urls: { profile: '/users/profile' },
  };

  const homeNav = buildFarmerBottomNav({ ...baseBootstrap, path: '/farmer/dashboard' });
  assert.deepEqual(
    homeNav.map((item) => item.label),
    ['Home', 'Diagnose', 'Ask AI', 'History', 'Profile'],
  );
  assert.equal(homeNav.find((i) => i.id === 'home')?.active, true);
  assert.equal(homeNav.filter((i) => i.active).length, 1);

  const diagNav = buildFarmerBottomNav({ ...baseBootstrap, path: '/farmer/diagnose/rule-based' });
  assert.equal(diagNav.find((i) => i.id === 'diagnose')?.active, true);

  const chatNav = buildFarmerBottomNav({ ...baseBootstrap, path: '/farmer/chat/44' });
  assert.equal(chatNav.find((i) => i.id === 'ask-ai')?.active, true);

  const historyNav = buildFarmerBottomNav({ ...baseBootstrap, path: '/farmer/result/19' });
  assert.equal(historyNav.find((i) => i.id === 'history')?.active, true);

  const profileNav = buildFarmerBottomNav({ ...baseBootstrap, path: '/users/profile' });
  assert.equal(profileNav.find((i) => i.id === 'profile')?.active, true);
});
