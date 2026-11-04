import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-revalidate-token');
  
  if (!process.env.REVALIDATE_TOKEN || token !== process.env.REVALIDATE_TOKEN) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  try {
    revalidatePath('/');
    revalidateTag('painel-economia');
    revalidatePath('/meio-ambiente');
    revalidatePath('/dinheiro');
    revalidatePath('/metodologia');
    revalidatePath('/sobre');
    revalidatePath('/economia', 'layout');
    revalidatePath('/explorar');
    revalidatePath('/presidente/[pessoa]', 'page');
    revalidatePath('/sitemap.xml');
    revalidatePath('/sitemaps/[id]', 'page');
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch {
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
