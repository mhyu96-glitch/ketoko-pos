import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('memuat halaman login Ketoko POS dengan sukses', async ({ app, screen }) => {
  await app.open('/');

  // Pastikan judul KetokoPOS dan tombol Masuk Aplikasi tampil di layar
  await expect(screen.getByRole('heading', 'KetokoPOS')).toBeVisible();
  await expect(screen.getByRole('button', 'Masuk Aplikasi')).toBeVisible();
});
