using System;
using System.Collections.Generic;
using System.Linq;
using LaunchPad.Models;
using Microsoft.Data.Entity;

namespace LaunchPad.DAL
{
    public class PowerShellRepository : IScriptRepository
    {
        private ApplicationDbContext _context;

        public PowerShellRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        //SCRIPTS
        public IEnumerable<Script> GetScripts()
        {
            return _context.Scripts.ToList();
        }

        public Script GetScriptById(int id)
        {
            //TODO: At this time(11/16/2015), EF7 Has Not Implmented the Find Method
            return _context.Scripts.First(e => e.Id == id);
        }

        public void InsertScript(Script script)
        {
            _context.Scripts.Add(script);
        }

        public void UpdateScript(Script script)
        {
            _context.Entry(script).State = EntityState.Modified;
        }

        public void DeleteScript(int id)
        {
            var script = GetScriptById(id);
            _context.Scripts.Remove(script);
        }


        //JOBS
        public IEnumerable<Job> GetJobs()
        {
            return _context.Jobs.ToList();
        }

        public Job GetJobById(int id)
        {
            //TODO: At this time(11/16/2015), EF7 Has Not Implmented the Find Method
            return _context.Jobs.First(e => e.Id == id);
        }

        public void InsertJob(Job job)
        {
            _context.Jobs.Add(job);
        }

        public void UpdateJob(Job job)
        {
            _context.Entry(job).State = EntityState.Modified;
        }

        public void DeleteJob(int id)
        {
            var job = GetJobById(id);
            _context.Jobs.Remove(job);
        }

        public void Save()
        {
            _context.SaveChanges();
        }

        private bool disposed = false;

        protected virtual void Dispose(bool disposing)
        {
            if (!this.disposed)
            {
                if (disposing)
                {
                    _context.Dispose();
                }
            }
            this.disposed = true;
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }
    }
}
