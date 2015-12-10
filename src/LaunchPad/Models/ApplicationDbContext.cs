using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using Microsoft.Data.Entity;

namespace LaunchPad.Models
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public DbSet<Script> Scripts { get; set; }
        public DbSet<Job> Jobs { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            // Customize the ASP.NET Identity model and override the defaults if needed.
            // For example, you can rename the ASP.NET Identity table names and more.
            // Add your customizations after calling base.OnModelCreating(builder);
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlServer(Startup.Configuration["Data:DefaultConnection:ConnectionString"]);
        }
    }


    public class IdentityManager
    {

        private readonly UserManager<ApplicationUser> _userManager;

        public IdentityManager(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }
        public async Task<bool> RoleExists(string name)
        {
            var roles = new List<IRoleValidator<IdentityRole>>();
            var rm = new RoleManager<IdentityRole>(
                new RoleStore<IdentityRole>(new ApplicationDbContext()), roles, null, null, null, null);
            return await rm.RoleExistsAsync(name);
        }

        //ToDo: Ensure Role Does Not Exist
        public async Task<bool> CreateRole(string name)
        {
            var roles = new List<IRoleValidator<IdentityRole>>();
            var rm = new RoleManager<IdentityRole>(
                new RoleStore<IdentityRole>(new ApplicationDbContext()), roles, null, null, null, null);
            var idResult = await rm.CreateAsync(new IdentityRole(name));
            return idResult.Succeeded;
        }

        public async Task<string> GetRoleIdByName(string name)
        {
            var roles = new List<IRoleValidator<IdentityRole>>();
            var rm = new RoleManager<IdentityRole>(
                new RoleStore<IdentityRole>(new ApplicationDbContext()), roles, null, null, null, null);
            var role = await rm.FindByNameAsync(name);
            return role.Id;
        }

        public async Task<IEnumerable<IdentityRole>> GetRoles()
        {
            var roles = new List<IRoleValidator<IdentityRole>>();
            var rm = new RoleManager<IdentityRole>(
                new RoleStore<IdentityRole>(new ApplicationDbContext()), roles, null, null, null, null);
            var allRoles = await rm.Roles.ToListAsync();
            return allRoles;
        }

        public async Task<bool> CreateUser(ApplicationUser user, string password)
        {
            var idResult = await _userManager.CreateAsync(user, password);
            return idResult.Succeeded;
        }


        public async Task<bool> AddUserToRole(string userId, string roleId)
        {
            var roles = new List<IRoleValidator<IdentityRole>>();
            var rm = new RoleManager<IdentityRole>(
                new RoleStore<IdentityRole>(new ApplicationDbContext()), roles, null, null, null, null);
            var user = await _userManager.FindByIdAsync(userId);
            var role = await rm.FindByIdAsync(roleId);
            var addResult = await _userManager.AddToRoleAsync(user, role.Name);
            return addResult.Succeeded;
        }

        public async Task<IList<string>> GetUserRoles(ApplicationUser user)
        {
            var currentRoles = await _userManager.GetRolesAsync(user);
            return currentRoles;
        }


        public async Task<bool> ClearUserRoles(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            var currentRoles = await _userManager.GetRolesAsync(user);
            var result = await _userManager.RemoveFromRolesAsync(user, currentRoles);
            return result.Succeeded;
        }
    }
}
