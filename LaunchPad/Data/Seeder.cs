using Microsoft.AspNetCore.Hosting;

namespace LaunchPad.Data
{
    public class Seeder
    {
        private readonly ApplicationDbContext _context;
        private readonly IHostingEnvironment _hosting;

        public Seeder(ApplicationDbContext context, IHostingEnvironment hosting)
        {
            _context = context;
            _hosting = hosting;
        }

        public void Seed()
        {
            _context.Database.EnsureCreated();

            // Check if any user exists.
            //if (!_context.Users.Any())
            //{
                
            //}

            // Todo: Create some seed data?

            _context.SaveChanges();
;        }
    }
}
