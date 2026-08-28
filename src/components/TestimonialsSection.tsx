import TestimonialCard from '@/components/TestimonialCard'
import { TESTIMONIALS } from '@/lib/testimonials'

export default function TestimonialsSection() {
  // The whole feature ships dark. Until the first testimonial is merged into
  // src/content/testimonials.json this renders nothing at all — no empty grid,
  // no placeholder advertising the absence.
  if (TESTIMONIALS.length === 0) return null

  return (
    <section id="testimonials" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 text-center">Testimonials</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {TESTIMONIALS.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>

        <div className="max-w-3xl mx-auto mt-12 pt-8 border-t border-white/10 space-y-4 text-sm text-gray-400 leading-relaxed">
          <p>
            <span className="text-gray-300 font-semibold">How this section works</span> — I invite people by private
            link, one at a time, and only people I&apos;ve actually worked with; there&apos;s no open form, so every
            name here is someone I can point to a project with. I read submissions before they go up and may fix a
            typo or trim for length, never change what someone meant.
          </p>
          <p>
            These are personal comments from people I worked with directly, written in a personal capacity. Company
            names say where we worked together — they are not endorsements by those companies, and nobody quoted here
            is speaking for their employer.
          </p>
          <p>
            <a
              href="mailto:andre.serban96@gmail.com"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md"
            >
              Are you quoted here and want it removed?
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
