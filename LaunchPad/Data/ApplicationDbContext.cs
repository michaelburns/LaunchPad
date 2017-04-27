using LaunchPad.Models;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base (options)
        {
                
        }

        public DbSet<Script> Scripts { get; set; }
        public DbSet<Job> Jobs { get; set; }
    }
}
