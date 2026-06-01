import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = 'https://dvjmqgzpxpfwuxpjrsdx.supabase.co'
const SUPABASE_KEY   = Deno.env.get('SERVICE_ROLE_KEY')!

serve(async (req) => {
  console.log('Function called!')
  try {
    const body = await req.json()
    console.log('Body:', JSON.stringify(body))

    const offer = body.record ?? body.new ?? body
    console.log('Offer:', JSON.stringify(offer))

    if (!offer?.request_id) {
      console.log('No request_id, skipping')
      return new Response('No offer data', { status: 200 })
    }

    const db = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Отримуємо запит
    const { data: request, error: reqError } = await db
      .from('requests')
      .select('title, user_id')
      .eq('id', offer.request_id)
      .single()

    console.log('Request:', JSON.stringify(request), 'Error:', JSON.stringify(reqError))

    if (!request) return new Response('Request not found', { status: 200 })

    // Не відправляємо якщо продавець == покупець
    if (offer.user_id === request.user_id) {
      console.log('Same user, skipping')
      return new Response('Same user', { status: 200 })
    }

    // Отримуємо email покупця
    const { data: userData, error: userError } = await db.auth.admin.getUserById(request.user_id)
    console.log('User error:', JSON.stringify(userError))
    const buyerEmail = userData?.user?.email
    console.log('Buyer email:', buyerEmail)

    if (!buyerEmail) return new Response('No email', { status: 200 })

    // Отримуємо ім'я продавця
    const { data: seller } = await db
      .from('profiles')
      .select('name')
      .eq('id', offer.user_id)
      .single()

    const sellerName = seller?.name || 'Хтось'

    // Відправляємо email
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'ХочуКупити <onboarding@resend.dev>',
        to: buyerEmail,
        subject: `Нова пропозиція на ваш запит "${request.title}"`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#1A1A18;margin-bottom:8px;">Нова пропозиція!</h2>
            <p style="color:#6B6B66;margin-bottom:24px;">
              <strong>${sellerName}</strong> відповів на ваш запит
              <strong>"${request.title}"</strong>
            </p>
            <div style="background:#F7F6F2;border-radius:12px;padding:16px;margin-bottom:24px;">
              <p style="margin:0;color:#1A1A18;"><strong>Опис:</strong> ${offer.description}</p>
              <p style="margin:8px 0 0;color:#1D9E75;font-size:18px;font-weight:600;">
                ${Number(offer.price).toLocaleString('uk')} ₴
              </p>
            </div>
            <a href="https://stupendous-zuccutto-7118eb.netlify.app"
               style="display:inline-block;background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Переглянути пропозицію →
            </a>
            <p style="color:#6B6B66;font-size:12px;margin-top:24px;">ХочуКупити — реверс-маркетплейс</p>
          </div>
        `
      })
    })

    const emailText = await emailRes.text()
    console.log('Resend response:', emailRes.status, emailText)

    if (!emailRes.ok) return new Response(`Resend error: ${emailText}`, { status: 500 })

    return new Response('Email sent!', { status: 200 })

  } catch (e) {
    console.log('ERROR:', e.message)
    return new Response(`Error: ${e.message}`, { status: 500 })
  }
})