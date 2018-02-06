using System.Linq;
using LaunchPad.Models;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Data
{
    // Todo: Finish implementing interface with EF
    public class ScriptRepository : IScriptRepository
    {
        private ApplicationDbContext _context;

        public ScriptRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        // Scripts
        public IQueryable<Script> GetScripts()
        {
            return _context.Scripts.Include("Category");
        }

        public Script GetScriptById(int scriptId)
        {
            return _context.Scripts.Include("Category").FirstOrDefault(s => s.Id == scriptId);
        }

        public void InsertScript(Script script)
        {
            _context.Scripts.Add(script);
        }

        public void UpdateScript(Script script)
        {
            _context.Entry(script).State = EntityState.Modified;
        }

        public void DeleteScript(int scriptId)
        {
            var script = GetScriptById(scriptId);
            _context.Scripts.Remove(script);
        }


        // Categories
        public IQueryable<Category> GetCategories()
        {
            return _context.Categories;
        }


        // Jobs
        public IQueryable<Job> GetJobs()
        {
            return _context.Jobs;
        }

        public Job GetJobById(int jobId)
        {
            return _context.Jobs.FirstOrDefault(j => j.Id == jobId);
        }

        public void InsertJob(Job job)
        {
            _context.Jobs.Add(job);
        }
        
        public void UpdateJob(Job job)
        {
            _context.Entry(job).State = EntityState.Modified;
        }

        public void DeleteJob(int jobId)
        {
            var job = GetJobById(jobId);
            _context.Jobs.Remove(job);
        }


        public void Save()
        {
            _context.SaveChanges(); // TODO: Look into SaveChangesAsync
        }

      
    }
}
