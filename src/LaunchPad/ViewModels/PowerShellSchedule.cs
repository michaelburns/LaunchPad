using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNet.Mvc.Rendering;

namespace LaunchPad.ViewModels
{
    public class PowerShellSchedule
    {
        public int Id { get; set; }
        public DateTime Date { get; set; }
        public string SelectedRecurring { get; set; }
        public IEnumerable<SelectListItem> Recurring { get; set; }
        [Required] //TODO- Required only handled in the View right now
        public Dictionary<string, string> PSparams { get; set; }
    }
}

